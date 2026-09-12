/**
 * COMMERCE layer — creates a counter sale end-to-end: validates the
 * submission, prices it server-side, writes the order and its items, records
 * the payment. The counter-sale sibling of create-order.ts, sharing its
 * idempotent-replay shape but none of its online-checkout assumptions — see
 * price-counter-sale.ts and persist-counter-sale.ts for what actually differs.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order } from '@/types/order';
import { priceCounterSale } from './price-counter-sale';
import { findStockShortage } from './price-order';
import { persistCounterSale } from './persist-counter-sale';
import { reserveOrderNumber } from './order-number';
import { resolveCustomerId } from './customer-identity';
import { validateCounterSaleSubmission } from './counter-sale-submission';
import type { CounterSaleSubmission, CounterSalePriced } from './counter-sale.types';

export type { CounterSaleSubmission };

export type CreateCounterSaleResult =
  | { ok: true; order: Order; replayed?: boolean }
  | { ok: false; error: string; status: number };

/** Who rang this sale up — the admin actor, carried onto the payment and the
 *  status-history row exactly like any other admin-caused change. */
export interface CounterSaleActor {
  id: string;
  email: string | null;
}

async function findOrderIdByIdempotencyKey(
  supabase: SupabaseClient,
  idempotencyKey: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error) {
    console.error('Idempotency lookup failed:', error.message);
    return null;
  }

  return data?.id ?? null;
}

/**
 * The full, printable order — fetched once at the end regardless of which
 * path produced it (fresh creation, a concurrent double-click, or an outright
 * replay). A cashier has no orders:read, so this is deliberately not a second
 * HTTP round trip through an endpoint gated on that permission: it is one more
 * read on the same server-side client already used to create the sale, whose
 * result the route hands back directly for OrderPrintDocument to render.
 */
async function fetchOrderForReceipt(supabase: SupabaseClient, orderId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single();

  if (error) {
    console.error(`Could not load counter sale ${orderId} for its receipt:`, error.message);
    return null;
  }

  return data as unknown as Order;
}

export async function createCounterSale(
  supabase: SupabaseClient,
  submission: CounterSaleSubmission,
  actor: CounterSaleActor
): Promise<CreateCounterSaleResult> {
  const validation = validateCounterSaleSubmission(submission);
  if (!validation.ok) {
    return { ok: false, status: validation.status, error: validation.error };
  }
  const { idempotencyKey, customerName, customerEmail, customerPhone, paymentMethod } = validation.validated;

  const existingId = await findOrderIdByIdempotencyKey(supabase, idempotencyKey);
  if (existingId) {
    const order = await fetchOrderForReceipt(supabase, existingId);
    if (!order) return { ok: false, status: 500, error: 'That sale exists but could not be loaded.' };
    return { ok: true, order, replayed: true };
  }

  const reserved = await reserveOrderNumber(supabase, idempotencyKey);
  if (!reserved.ok) {
    return { ok: false, status: reserved.status, error: reserved.error };
  }
  const orderNumber = reserved.orderNumber;

  const pricing = await priceCounterSale(supabase, submission.items);
  if (!pricing.ok) {
    return { ok: false, status: pricing.status, error: pricing.error };
  }
  const priced: CounterSalePriced = pricing.priced;

  const shortage = findStockShortage(priced.items);
  if (shortage) {
    return { ok: false, status: 409, error: shortage };
  }

  // Only attempted when an email was actually given — a cash sale to someone
  // who declines to give one stays a sale with no customer_id, exactly like a
  // guest checkout that resolveCustomerId already handles gracefully.
  const customerId = customerEmail
    ? await resolveCustomerId(supabase, { email: customerEmail, name: customerName, phone: customerPhone })
    : null;

  const persisted = await persistCounterSale(
    supabase,
    {
      order_number: orderNumber,
      idempotency_key: idempotencyKey,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      customer_id: customerId,
      payment_method: paymentMethod,
      actor_id: actor.id,
      actor_email: actor.email,
    },
    priced
  );

  if (!persisted.ok) {
    return persisted;
  }

  const order = await fetchOrderForReceipt(supabase, persisted.order.id);
  if (!order) return { ok: false, status: 500, error: 'The sale was recorded but the receipt could not be loaded.' };

  return { ok: true, order, replayed: persisted.joinedExisting };
}
