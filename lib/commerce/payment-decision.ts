/**
 * COMMERCE layer (server only) — what the order, and the customer, do about a
 * payment decision that has already been recorded.
 *
 * Split from order-payments.ts, which records the decision. The two halves are
 * genuinely different jobs and only one of them can fail harmlessly: the row is
 * durable before anything here runs, so every branch below is best-effort
 * about the message and strict about the money. A mail server being down must
 * never make it look as though nothing was received.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { applyOrderStatusTransition, type StatusChangeActor } from './order-status-transition';
import { sendPaymentShortfallNotice, sendPaymentRejectedNotice } from '@/lib/notifications';
import type { PaymentStatus } from '@/types/payment';

/** The order columns a decision needs. Selected by ORDER_COLUMNS in
 *  order-payments.ts, which is the only caller. */
export interface PaymentOrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  status: string;
  total_amount: number;
  amount_paid: number;
  payment_verified: boolean | null;
  receipt_path: string | null;
}

export interface DecisionContext {
  /** What was recorded. Drives which email goes out, independently of the
   *  arithmetic — see applyDecisionToOrder. */
  status: PaymentStatus;
  settled: boolean;
  receivedNow: number;
  receivedTotal: number;
  outstanding: number;
  reasonCode: string | null;
  note: string | null;
  notify: boolean;
  actor?: StatusChangeActor | null;
}

/**
 * WHAT THE CUSTOMER IS TOLD, AND WHAT THE ORDER DOES, ARE DECIDED SEPARATELY
 *
 * The email follows the decision that was recorded; the order state follows
 * the arithmetic. Those usually agree, and the case where they do not is real:
 * rejecting a duplicate receipt on an order whose money has already arrived
 * under an earlier payment. The customer must hear "this receipt is a
 * duplicate", because that is what they did — while the order, which is in
 * fact paid for, still gets confirmed. Deriving the email from the totals
 * would send that customer a payment confirmation for a receipt just refused.
 */
export async function applyDecisionToOrder(
  supabase: SupabaseClient,
  order: PaymentOrderRow,
  context: DecisionContext
): Promise<{ confirmed: boolean; warning?: string }> {
  // A refusal always says so, settled or not. A shortfall only when there is
  // still a balance — a top-up recorded as 'short_paid' that happens to clear
  // the order is confirmed below, and the confirmation is the right message.
  if (context.notify && (context.status === 'rejected' || !context.settled)) {
    await notifyOutcome(order, context);
  }

  if (!context.settled) return { confirmed: false };

  // Money in full against an order nobody is going to fulfil. Recorded — it
  // has to be, there is a refund to make — but not resurrected: reopening a
  // cancelled order is a decision for a person.
  if (order.status === 'cancelled') {
    return {
      confirmed: false,
      warning: 'This order is cancelled. The payment is recorded, but the order was not confirmed.',
    };
  }

  const paidColumns = { payment_verified: true, paid_at: new Date().toISOString() };

  // Already moved by hand while the money was being checked. Record the fact
  // and stop — a transition would re-notify the customer about a status they
  // already have.
  if (order.status !== 'pending') {
    await supabase.from('orders').update(paidColumns).eq('id', order.id);
    return { confirmed: false };
  }

  const transition = await applyOrderStatusTransition(supabase, order.id, 'confirmed', {
    // A rejection has already had its own email. Sending the confirmation on
    // top would be two contradictory messages a minute apart.
    sendNotification: context.notify && context.status !== 'rejected',
    paymentVerified: true,
    notificationMessage:
      'We have confirmed your payment and your order is confirmed. We will let you know as soon as it ships.',
    actor: context.actor ?? null,
    reason: 'Payment verified',
  });

  if (!transition.success) {
    console.error(`Payment recorded but confirmation failed for ${order.order_number}: ${transition.error}`);
    // The money stands recorded; the order did not move. Say so rather than
    // reporting success — this is the shop's problem to finish.
    return { confirmed: false, warning: `Payment saved, but the order could not be confirmed: ${transition.error}` };
  }

  await supabase.from('orders').update(paidColumns).eq('id', order.id);
  return { confirmed: true };
}

/** The customer's copy: a refusal with its next step, or a balance to pay. */
async function notifyOutcome(order: PaymentOrderRow, context: DecisionContext): Promise<void> {
  const params = {
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    totalAmount: order.total_amount,
    receivedTotal: context.receivedTotal,
    received: context.receivedNow,
    outstanding: context.outstanding,
    reasonCode: context.reasonCode,
    note: context.note,
  };

  const result = context.status === 'rejected'
    ? await sendPaymentRejectedNotice(params)
    : await sendPaymentShortfallNotice(params);

  if (!result.success) {
    console.error(`Could not email the payment outcome for ${order.order_number}:`, result.detail);
  }
}
