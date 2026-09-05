/**
 * COMMERCE layer (server only) — money going back out.
 *
 * The mirror of order-payments.ts, and shaped deliberately like it: a refund
 * is an observation recorded once ("we are sending 5,000 back because the item
 * was faulty"), and what the order does about it is arithmetic over the rows,
 * not a consequence of which button was pressed.
 *
 * THE ONE RULE THAT MATTERS
 *
 * A shop cannot refund money it never received. Refunds are therefore checked
 * against orders.amount_paid, not against total_amount — an order for 20,000
 * that was part paid 12,000 can have at most 12,000 back. Getting this wrong
 * is not a rounding error; it is the shop paying a stranger.
 *
 * A refund is agreed and then, separately, sent. Both moments notify the
 * customer, because "we will refund you" and "we have refunded you, here is
 * the reference" answer different questions and a customer who only gets the
 * first will chase.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { round2 } from './payment-outcome';
import { isRefundCode, isRefundMethod, type RefundMethod } from './refund-reasons';
import { announceRefund } from './refund-notify';
import type { StatusChangeActor } from './order-status-transition';

const ORDER_COLUMNS =
  'id, order_number, customer_name, customer_email, total_amount, amount_paid, amount_refunded';

export interface RecordRefundInput {
  orderId: string;
  amount: number;
  method?: string;
  reasonCode: string;
  note?: string | null;
  reference?: string | null;
  /** True when the money has already left — records it settled in one step,
   * which is what a cash refund over the counter actually is. */
  settled?: boolean;
  notify?: boolean;
}

export type RefundResult =
  | {
      ok: true;
      refundId: string;
      /** Refunded against this order in total, after this one. */
      refundedTotal: number;
      /** Still refundable: what arrived, less what has gone back. */
      refundable: number;
      notified: boolean;
    }
  | { ok: false; error: string; status: number };

/** Naira figure from an untrusted body, or null when it is not one. */
function readAmount(value: unknown): number | null {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null;
  return round2(amount);
}

export async function recordOrderRefund(
  supabase: SupabaseClient,
  input: RecordRefundInput,
  actor?: StatusChangeActor | null
): Promise<RefundResult> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('id', input.orderId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: 'Order not found', status: 404 };
  }

  const order = data as any;
  const amount = readAmount(input.amount);

  if (amount === null) {
    return { ok: false, error: 'Enter the amount you are refunding.', status: 400 };
  }

  if (!isRefundCode(input.reasonCode)) {
    return { ok: false, error: 'Choose why this refund is being issued.', status: 400 };
  }

  // numeric columns arrive as strings often enough that coercing is not
  // optional — `'12000.00' - 0` would work and `'12000.00' > 5000` would not.
  const paid = Number(order.amount_paid ?? 0);
  const alreadyRefunded = Number(order.amount_refunded ?? 0);
  const refundable = round2(paid - alreadyRefunded);

  if (paid <= 0) {
    return {
      ok: false,
      error: 'No money has been received against this order, so there is nothing to refund.',
      status: 400,
    };
  }

  if (amount > refundable) {
    return {
      ok: false,
      error: `Only ${refundable.toFixed(2)} can be refunded — that is what was received, less what has already gone back.`,
      status: 400,
    };
  }

  const method: RefundMethod = isRefundMethod(input.method) ? input.method : 'transfer';
  const settled = input.settled === true;

  const { data: inserted, error: insertError } = await supabase
    .from('order_refunds')
    .insert({
      order_id: order.id,
      status: settled ? 'completed' : 'pending',
      amount,
      method,
      reference: input.reference?.trim() || null,
      reason_code: input.reasonCode,
      note: input.note?.trim() || null,
      refunded_at: settled ? new Date().toISOString() : null,
      actor_id: actor?.id ?? null,
      actor_email: actor?.email ?? null,
    })
    .select('id')
    .maybeSingle();

  if (insertError || !inserted) {
    console.error(`Could not record refund for ${order.order_number}:`, insertError?.message);
    return { ok: false, error: 'Could not save this refund. Nothing was changed.', status: 500 };
  }

  // Only a completed refund is money, so only it moves the running total —
  // and that total comes from the trigger rather than from this addition, so
  // it is right even if another refund was recorded concurrently.
  const refundedTotal = settled ? await readRefundedTotal(supabase, order.id, alreadyRefunded + amount) : alreadyRefunded;

  const notified = input.notify === false
    ? false
    : await announceRefund(order, {
        amount,
        refundedTotal: settled ? refundedTotal : round2(alreadyRefunded + amount),
        settled,
        reasonCode: input.reasonCode,
        note: input.note ?? null,
        reference: input.reference ?? null,
        method,
      });

  return {
    ok: true,
    refundId: (inserted as any).id,
    refundedTotal,
    refundable: round2(paid - (settled ? refundedTotal : alreadyRefunded)),
    notified,
  };
}

/** The trigger-maintained figure, falling back to the projection if the
 * re-read fails — a wrong number in a response is better than a 500 over an
 * action that already succeeded. */
async function readRefundedTotal(
  supabase: SupabaseClient,
  orderId: string,
  projected: number
): Promise<number> {
  const { data } = await supabase
    .from('orders')
    .select('amount_refunded')
    .eq('id', orderId)
    .maybeSingle();

  return round2(Number((data as any)?.amount_refunded ?? projected));
}
