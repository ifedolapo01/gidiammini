/**
 * COMMERCE layer — creates a customer order end-to-end: validates the
 * submission, prices it server-side, writes the order and its items, seeds the
 * status history, and sends the order-received email. Shared shape with the
 * other order mutations in this folder (applyOrderStatusTransition,
 * applyOrderShippingTransition) so the API route stays a thin adapter.
 *
 * The one rule this file exists to enforce: every amount persisted comes from
 * priceOrder() reading the live catalogue. The caller's own figures are only
 * ever compared, never stored.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { priceOrder, findStockShortage } from './price-order';
import type { PricedOrder } from './price-order.types';
import { sendOrderReceivedEmail } from '@/lib/notifications';
import { INITIAL_ORDER_STATUS } from './order-status';
import { persistOrderWithReservedStock } from './persist-order';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Everything the checkout is allowed to submit. Anything not named here
 * cannot reach the database, whatever else the request body contains. */
export interface CreateOrderSubmission {
  order_number?: unknown;
  customer_name?: unknown;
  customer_email?: unknown;
  customer_phone?: unknown;
  /** The total the customer was shown. Compared, never stored. */
  expected_total?: unknown;
  delivery_option?: unknown;
  selected_state?: unknown;
  selected_lga?: unknown;
  selected_place?: unknown;
  delivery_address?: unknown;
  city?: unknown;
  note?: unknown;
  receipt_path?: unknown;
  items?: unknown;
}

export type CreateOrderResult =
  | { ok: true; order: { id: string; order_number: string } }
  | { ok: false; error: string; status: number; code?: 'price_mismatch'; quote?: PricedOrder };

export async function createCustomerOrder(
  supabase: SupabaseClient,
  submission: CreateOrderSubmission
): Promise<CreateOrderResult> {
  const orderNumber = trimmed(submission.order_number);
  const customerName = trimmed(submission.customer_name);
  const customerEmail = trimmed(submission.customer_email).toLowerCase();
  const customerPhone = trimmed(submission.customer_phone);

  if (!orderNumber || !customerName || !customerEmail || !customerPhone) {
    return { ok: false, status: 400, error: 'Your name, email, phone and order number are all required.' };
  }

  if (!EMAIL_PATTERN.test(customerEmail)) {
    return { ok: false, status: 400, error: 'Please enter a valid email address.' };
  }

  // The only source of every amount written below.
  const pricing = await priceOrder(supabase, {
    items: submission.items,
    deliveryOption: submission.delivery_option,
    selectedState: submission.selected_state,
    selectedLga: submission.selected_lga,
    selectedPlace: submission.selected_place,
  });

  if (!pricing.ok) {
    return { ok: false, status: pricing.status, error: pricing.error };
  }

  const { priced } = pricing;

  const shortage = findStockShortage(priced.items);
  if (shortage) {
    return { ok: false, status: 409, error: shortage };
  }

  const deliveryAddress = trimmed(submission.delivery_address);
  if (priced.requires_address && !deliveryAddress) {
    return { ok: false, status: 400, error: 'A delivery address is required for this location.' };
  }

  // The customer has already been shown an amount to transfer, so a
  // disagreement is never resolved by charging them the other number — it is
  // reported, with the corrected breakdown, for a person to resolve.
  const expectedTotal = Number(submission.expected_total);
  if (Number.isFinite(expectedTotal) && Math.round(expectedTotal) !== priced.total) {
    console.warn(
      `Price mismatch on ${orderNumber}: client expected ${expectedTotal}, server priced ${priced.total}`
    );
    return {
      ok: false,
      status: 409,
      code: 'price_mismatch',
      error: 'Prices changed while you were checking out. Please review the updated total before paying.',
      quote: priced,
    };
  }

  // Claims stock, then writes the order and its items, unwinding whatever it
  // completed if a later step fails.
  const persisted = await persistOrderWithReservedStock(
    supabase,
    {
      order_number: orderNumber,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      delivery_address: priced.delivery_option === 'delivery' ? deliveryAddress || null : null,
      city: trimmed(submission.city) || null,
      note: trimmed(submission.note) || null,
      receipt_path: trimmed(submission.receipt_path) || null,
    },
    priced
  );

  if (!persisted.ok) {
    return persisted;
  }

  const { order } = persisted;

  // Best-effort from here on: the order exists, its stock is held, and the
  // customer has their number on screen — neither a missed history row nor a
  // failed email is worth failing the request over.
  const { error: historyError } = await supabase
    .from('order_status_history')
    .insert({ order_id: order.id, status: INITIAL_ORDER_STATUS, changed_at: new Date().toISOString() });
  if (historyError) {
    console.error('Error recording initial status history:', historyError);
  }

  try {
    await sendOrderReceivedEmail({
      orderNumber: order.order_number,
      customerName: customerName,
      customerEmail: customerEmail,
    });
  } catch (notificationError) {
    console.error('Order-received email error:', notificationError);
  }

  return { ok: true, order };
}
