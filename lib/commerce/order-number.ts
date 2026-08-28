/**
 * COMMERCE layer — server-issued order numbers.
 *
 * The number used to be minted in the browser as
 * `UT${Date.now().toString().slice(-8)}`, which collides for two checkouts in
 * the same millisecond and left the resulting unique-constraint failure
 * unhandled. It now comes from a Postgres sequence.
 *
 * It has to be issued *before* the order row exists, because the customer is
 * shown it on the payment screen and told to use it as their bank transfer
 * remark (components/checkout/BankDetails.tsx). So it is reserved against the
 * checkout's idempotency key at the step-1 -> step-2 gate. Reserving with the
 * same key again returns the same number, so a customer who goes back and
 * resubmits is never handed a second number after they may already have
 * initiated a transfer.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** Matches the shape reserve_order_number() produces: UT + 8 digits. */
export const ORDER_NUMBER_PATTERN = /^UT\d{8}$/;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a syntactically valid idempotency key. Pure, so it can be checked
 * before spending a database round trip. */
export function isValidIdempotencyKey(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

export type ReserveOrderNumberResult =
  | { ok: true; orderNumber: string }
  | { ok: false; error: string; status: number };

/**
 * Issues the order number for a checkout attempt, or returns the one already
 * issued for that key.
 */
export async function reserveOrderNumber(
  supabase: SupabaseClient,
  idempotencyKey: unknown
): Promise<ReserveOrderNumberResult> {
  if (!isValidIdempotencyKey(idempotencyKey)) {
    return { ok: false, status: 400, error: 'This checkout session is missing its reference. Please reload and try again.' };
  }

  const { data, error } = await supabase.rpc('reserve_order_number', {
    p_idempotency_key: idempotencyKey.trim().toLowerCase(),
  });

  if (error || typeof data !== 'string' || !data) {
    console.error('Could not reserve an order number:', error?.message ?? 'no value returned');
    return { ok: false, status: 503, error: 'We could not start your order. Please try again in a moment.' };
  }

  return { ok: true, orderNumber: data };
}
