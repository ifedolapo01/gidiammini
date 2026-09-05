/**
 * COMMERCE layer (server only) — a refund that was agreed actually goes out.
 *
 * Separate from order-refunds.ts because it is a different act with different
 * rules. Recording a refund checks it against what the customer paid; settling
 * one checks nothing about money at all — the amount was fixed when it was
 * agreed and the database refuses to change it (see the order_refunds_guard
 * trigger). What settling adds is a date and, for a transfer, the reference
 * the customer will look for on their statement.
 *
 * 'failed' is a first-class outcome, not an error. A transfer that bounces is
 * a fact about the refund, and recording it is how the pending queue stops
 * showing money that is never going to move on that attempt.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { round2 } from './payment-outcome';
import { announceRefund } from './refund-notify';
import type { StatusChangeActor } from './order-status-transition';

export interface SettleRefundInput {
  refundId: string;
  /** 'completed' — the money left. 'failed' — the attempt did not land. */
  outcome: 'completed' | 'failed';
  /** The outgoing transfer's bank reference. Only meaningful when completed. */
  reference?: string | null;
  note?: string | null;
  notify?: boolean;
}

export type SettleRefundResult =
  | { ok: true; orderId: string; refundedTotal: number; notified: boolean }
  | { ok: false; error: string; status: number };

const REFUND_COLUMNS =
  'id, order_id, status, amount, method, reason_code, note, reference, actor_id, actor_email';

export async function settleOrderRefund(
  supabase: SupabaseClient,
  input: SettleRefundInput,
  actor?: StatusChangeActor | null
): Promise<SettleRefundResult> {
  const { data: refund, error: readError } = await supabase
    .from('order_refunds')
    .select(REFUND_COLUMNS)
    .eq('id', input.refundId)
    .maybeSingle();

  if (readError || !refund) {
    return { ok: false, error: 'Refund not found', status: 404 };
  }

  const row = refund as any;

  // The trigger would refuse this anyway; catching it here turns a raw
  // SQLSTATE into a sentence, and avoids a pointless round trip.
  if (row.status !== 'pending') {
    return {
      ok: false,
      error: `This refund is already ${row.status}. Record a new one rather than reopening it.`,
      status: 409,
    };
  }

  const completed = input.outcome === 'completed';

  const { error: updateError } = await supabase
    .from('order_refunds')
    .update({
      status: input.outcome,
      refunded_at: completed ? new Date().toISOString() : null,
      reference: input.reference?.trim() || row.reference,
      // Appended rather than replaced: the note written when the refund was
      // agreed is part of why it was agreed, and losing it to a one-word
      // update ("bounced") would delete the reason.
      note: [row.note, input.note?.trim()].filter(Boolean).join('\n') || null,
      actor_id: actor?.id ?? row.actor_id ?? null,
      actor_email: actor?.email ?? row.actor_email ?? null,
    })
    .eq('id', row.id)
    // Nothing else may have settled it in the meantime.
    .eq('status', 'pending');

  if (updateError) {
    console.error(`Could not settle refund ${row.id}:`, updateError.message);
    return { ok: false, error: 'Could not update this refund. Nothing was changed.', status: 500 };
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, customer_email, total_amount, amount_refunded')
    .eq('id', row.order_id)
    .maybeSingle();

  const refundedTotal = round2(Number((order as any)?.amount_refunded ?? 0));

  // Only a completed refund is worth an email. "Your refund failed" tells the
  // customer about a problem they cannot do anything about; the shop retries
  // and tells them when it works.
  const notified = completed && input.notify !== false && order
    ? await announceRefund(order as any, {
        amount: Number(row.amount),
        refundedTotal,
        settled: true,
        reasonCode: row.reason_code,
        note: row.note,
        reference: input.reference ?? row.reference,
        method: row.method,
      })
    : false;

  return { ok: true, orderId: row.order_id, refundedTotal, notified };
}
