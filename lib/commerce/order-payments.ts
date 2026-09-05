/**
 * COMMERCE layer (server only) — recording what a verifier saw, and what the
 * order does about it.
 *
 * The one place a payment decision is written. Before this existed, "payment"
 * was a boolean flipped as a side effect of a status change, so the amount,
 * the reference, the date and the refusals were nowhere and revenue counted
 * orders whose money never arrived.
 *
 * THE ROW SAYS WHAT WAS SEEN; THE ARITHMETIC SAYS WHAT THE ORDER DOES
 *
 * A verifier records an observation — this much money, under this reference,
 * on this date, or none and here is why. Whether the order can be confirmed is
 * then a question about totals, not about which button was pressed: a second
 * payment labelled 'short_paid' that happens to clear the balance still
 * confirms the order, because the money is there. That split is what makes
 * part payments work at all.
 *
 * Nothing here is ever updated in place. A mistake is corrected by recording
 * another row, so the trail of what was believed and when survives.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { StatusChangeActor } from './order-status-transition';
import { settlement, round2 } from './payment-outcome';
import { isPaymentRejectionCode } from './payment-rejection';
import { applyDecisionToOrder, type PaymentOrderRow } from './payment-decision';
import type { PaymentMethod, PaymentStatus, RecordPaymentInput } from '@/types/payment';

const ORDER_COLUMNS =
  'id, order_number, customer_name, customer_email, status, total_amount, amount_paid, payment_verified, receipt_path';

export type RecordPaymentResult =
  | {
      ok: true;
      /** What was written. */
      status: PaymentStatus;
      /** Credited in total after this decision. */
      receivedTotal: number;
      outstanding: number;
      /** True when this decision settled the order and confirmed it. */
      confirmed: boolean;
      /** Set when the order could not be moved even though it is now paid —
       *  a cancelled order, or a transition that failed downstream. The money
       *  stands recorded either way. */
      warning?: string;
    }
  | { ok: false; error: string; code: 'not_found' | 'invalid' | 'write_failed'; status: number };

/** Naira figure from an untrusted body, or null when it is not one. */
function readAmount(value: unknown): number | null {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null;
  return round2(amount);
}

const METHODS: PaymentMethod[] = ['transfer', 'paystack', 'cash', 'pos'];

export async function recordOrderPayment(
  supabase: SupabaseClient,
  input: RecordPaymentInput,
  actor?: StatusChangeActor | null
): Promise<RecordPaymentResult> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('id', input.orderId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: 'Order not found', code: 'not_found', status: 404 };
  }

  const order = data as unknown as PaymentOrderRow;
  const rejected = input.status === 'rejected';
  const amount = rejected ? 0 : readAmount(input.amount);

  if (!rejected && amount === null) {
    return {
      ok: false,
      error: 'Enter the amount you actually received.',
      code: 'invalid',
      status: 400,
    };
  }

  if (rejected && !isPaymentRejectionCode(input.reasonCode)) {
    return {
      ok: false,
      error: 'Choose why this receipt is being rejected — the customer is told.',
      code: 'invalid',
      status: 400,
    };
  }

  // amount_paid is a Postgres `numeric`; coerced before it meets arithmetic.
  const alreadyPaid = Number(order.amount_paid ?? 0);
  const projected = settlement(order.total_amount, alreadyPaid + (amount ?? 0));

  // A 'verified' row asserts the order is paid for. Letting one through that
  // leaves a balance would mark the order paid while it is not, which is the
  // exact confusion this table was added to end.
  if (input.status === 'verified' && !projected.settled) {
    return {
      ok: false,
      error: `That leaves ${projected.outstanding.toFixed(2)} outstanding. Record it as a short payment instead.`,
      code: 'invalid',
      status: 400,
    };
  }

  const { error: insertError } = await supabase.from('order_payments').insert({
    order_id: order.id,
    status: input.status,
    amount: amount ?? 0,
    method: METHODS.includes(input.method as PaymentMethod) ? input.method : 'transfer',
    reference: input.reference?.trim() || null,
    received_at: input.receivedAt || new Date().toISOString(),
    reason_code: input.reasonCode ?? null,
    note: input.note?.trim() || null,
    // Snapshotted, so a later re-upload cannot silently change which image
    // this decision was made against.
    receipt_path: order.receipt_path,
    actor_id: actor?.id ?? null,
    actor_email: actor?.email ?? null,
  });

  if (insertError) {
    console.error(`Could not record payment for ${order.order_number}:`, insertError.message);
    return {
      ok: false,
      error: 'Could not save this payment. Nothing was changed.',
      code: 'write_failed',
      status: 500,
    };
  }

  // Re-read rather than trusting the projection: orders.amount_paid is
  // maintained by a trigger over every payment row, so this is the figure
  // after any decision recorded concurrently, not just after this one.
  const { data: after } = await supabase
    .from('orders')
    .select('amount_paid')
    .eq('id', order.id)
    .maybeSingle();

  const receivedTotal = round2(Number(after?.amount_paid ?? alreadyPaid + (amount ?? 0)));
  const final = settlement(order.total_amount, receivedTotal);

  const outcome = await applyDecisionToOrder(supabase, order, {
    status: input.status,
    settled: final.settled,
    receivedNow: amount ?? 0,
    receivedTotal,
    outstanding: final.outstanding,
    reasonCode: input.reasonCode ?? null,
    note: input.note ?? null,
    notify: input.notify !== false,
    actor,
  });

  return {
    ok: true,
    status: input.status,
    receivedTotal,
    outstanding: final.outstanding,
    confirmed: outcome.confirmed,
    warning: outcome.warning,
  };
}
