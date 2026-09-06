/**
 * COMMERCE layer — creates a customer order end-to-end: validates the
 * submission, prices it server-side, writes the order and its items, seeds the
 * status history, and sends the order-received email. Shared shape with the
 * other order mutations in this folder (applyOrderStatusTransition,
 * applyOrderShippingTransition) so the API route stays a thin adapter.
 *
 * Two rules this file exists to enforce:
 *
 *   1. Every amount persisted comes from priceOrder() reading the live
 *      catalogue. The caller's own figures are only ever compared, never stored.
 *   2. Creating an order is idempotent. The checkout flow uploads a receipt and
 *      then inserts, so a response lost after a successful insert used to leave
 *      the customer retrying into a second order against one payment — with
 *      stock claimed twice. A replay now returns the order that already exists.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { priceOrder, findStockShortage } from './price-order';
import type { CreateOrderSubmission } from './create-order.types';

export type { CreateOrderSubmission };
import type { PricedOrder } from './price-order.types';
import { persistOrderWithReservedStock } from './persist-order';
import { runOrderCreatedEffects } from './order-created-effects';
import { reserveOrderNumber } from './order-number';
import { resolveCustomerId } from './customer-identity';
import { validateOrderSubmission, trimmed } from './order-submission';

/** Everything the checkout is allowed to submit. Anything not named here
 * cannot reach the database, whatever else the request body contains. */
export type CreateOrderResult =
  | { ok: true; order: { id: string; order_number: string }; replayed?: boolean }
  | { ok: false; error: string; status: number; code?: 'price_mismatch'; quote?: PricedOrder };

/** The order this checkout attempt already created, if any. */
async function findOrderByIdempotencyKey(
  supabase: SupabaseClient,
  idempotencyKey: string
): Promise<{ id: string; order_number: string } | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error) {
    // Don't block a genuine order because the lookup hiccuped; the unique index
    // on idempotency_key is the real guarantee, and persistOrderWithReservedStock
    // handles the conflict.
    console.error('Idempotency lookup failed:', error.message);
    return null;
  }

  return data ?? null;
}

export async function createCustomerOrder(
  supabase: SupabaseClient,
  submission: CreateOrderSubmission
): Promise<CreateOrderResult> {
  // Shape and length are already guaranteed by the route's schema; this is the
  // business layer's own check, including whether the buyer is barred.
  const validation = await validateOrderSubmission(supabase, submission);
  if (!validation.ok) {
    return { ok: false, status: validation.status, error: validation.error };
  }
  const { idempotencyKey, customerName, customerEmail, customerPhone } = validation.validated;

  // Replay check first, before any pricing or stock work: if this checkout
  // attempt already produced an order, hand that one back rather than doing it
  // all again. This is the cheap path and the common one for a retry.
  const existing = await findOrderByIdempotencyKey(supabase, idempotencyKey);
  if (existing) {
    console.log(`Idempotent replay for ${existing.order_number} — returning the existing order.`);
    return { ok: true, order: existing, replayed: true };
  }

  const reserved = await reserveOrderNumber(supabase, idempotencyKey);
  if (!reserved.ok) {
    return { ok: false, status: reserved.status, error: reserved.error };
  }
  const orderNumber = reserved.orderNumber;

  // The only source of every amount written below.
  const pricing = await priceOrder(supabase, {
    items: submission.items,
    deliveryOption: submission.delivery_option,
    selectedState: submission.selected_state,
    selectedLga: submission.selected_lga,
    selectedPlace: submission.selected_place,
    // Re-validated here rather than carried over from the quote. Between the
    // two calls a code can expire, hit its ceiling, or be spent by the same
    // customer in another tab — and the quote's verdict is a display value
    // like every other number the browser holds.
    discountCode: submission.discount_code,
    customerEmail: submission.customer_email,
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

  // Resolve the buyer's durable identity before the insert so the order can
  // carry it. Returns null rather than throwing if anything goes wrong — the
  // order matters more than the link, which a backfill can repair.
  const customerId = await resolveCustomerId(supabase, {
    email: customerEmail,
    name: customerName,
    phone: customerPhone,
  });

  if (!customerId) {
    console.warn(`Order ${orderNumber} has no customer_id — identity could not be resolved.`);
  }

  // Claims stock, then writes the order and its items, unwinding whatever it
  // completed if a later step fails.
  const persisted = await persistOrderWithReservedStock(
    supabase,
    {
      order_number: orderNumber,
      customer_id: customerId,
      idempotency_key: idempotencyKey,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      delivery_address: priced.delivery_option === 'delivery' ? deliveryAddress || null : null,
      city: trimmed(submission.city) || null,
      note: trimmed(submission.note) || null,
      receipt_path: trimmed(submission.receipt_path) || null,
      payment_method: submission.payment_method ?? 'transfer',
    },
    priced
  );

  if (!persisted.ok) {
    return persisted;
  }

  const { order } = persisted;

  // Lost a concurrent race: the order exists but this call didn't make it, so
  // skip the history row and the email — the winning call already did both.
  if (persisted.joinedExisting) {
    return { ok: true, order, replayed: true };
  }

  await runOrderCreatedEffects(supabase, {
    orderId: order.id,
    orderNumber: order.order_number,
    customerName,
    customerEmail,
  });

  return { ok: true, order };
}
