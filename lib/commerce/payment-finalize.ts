/**
 * COMMERCE layer (server only) — turning a confirmed payment into a confirmed order.
 *
 * One function, called from two places that must not disagree: the webhook,
 * and the customer's return from the provider. Both can arrive, in either
 * order, more than once — so this is written to be run repeatedly and land in
 * the same state every time.
 *
 * WHAT IT DOES NOT DO
 *
 * It does not invent a status flow. An online payment arrives exactly where a
 * verified transfer arrives — payment_verified true, status 'confirmed' — and
 * gets there through applyOrderStatusTransition, which is what already sends
 * the notifications, writes the status history and reconciles stock. The whole
 * point of the issue was that the downstream machinery already exists.
 *
 * THE AMOUNT IS CHECKED, ALWAYS
 *
 * A payment for the wrong amount is never confirmed. It is flagged and left
 * for a person, because the two ways to resolve it automatically — confirm
 * anyway, or refuse a genuine payment — are both worse than a shopkeeper
 * looking at it.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { applyOrderStatusTransition } from './order-status-transition';
import { KOBO_PER_NAIRA, type VerifiedPayment } from '@/lib/payments/paystack';

export type FinalizeOutcome =
  /** Money confirmed and the order moved to 'confirmed'. */
  | { status: 'confirmed'; orderNumber: string; orderId: string }
  /** Already done. Both callers can arrive twice; this is the normal path for
   *  the second one, not an error. */
  | { status: 'already_paid'; orderNumber: string; orderId: string }
  /** The provider says it is not paid (abandoned, failed, still pending). */
  | { status: 'not_paid' }
  | { status: 'order_not_found' }
  /** Paid, but not the amount we asked for. Deliberately left for a human. */
  | { status: 'amount_mismatch'; orderNumber: string; orderId: string; expected: number; paid: number };

interface OrderRow {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  payment_verified: boolean | null;
}

const ORDER_COLUMNS = 'id, order_number, total_amount, status, payment_verified';

/**
 * The order a reference belongs to.
 *
 * Two lookups, and the second is the reason the reference is shaped
 * "<order number>-<random>": a customer who abandons one attempt and pays on
 * another leaves the order carrying the newer reference, so an exact match on
 * the older one finds nothing. The order number in front of the dash still
 * does. Order numbers are UT + 8 digits and contain no dash, so the parse is
 * unambiguous.
 */
async function findOrderByReference(
  supabase: SupabaseClient,
  reference: string
): Promise<OrderRow | null> {
  const { data: exact } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('payment_reference', reference)
    .maybeSingle();

  if (exact) return exact as unknown as OrderRow;

  const orderNumber = reference.split('-')[0];
  if (!orderNumber) return null;

  const { data: byNumber } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('order_number', orderNumber)
    .maybeSingle();

  return (byNumber as unknown as OrderRow) ?? null;
}

/**
 * What our own database already knows about this reference.
 *
 * Checked before the provider is asked, and consulted again if asking them
 * fails. The webhook is authoritative and usually lands first, so by the time
 * the customer's browser gets back the order is frequently already confirmed —
 * and if the provider is slow, rate-limiting us, or the reference is malformed,
 * an order that is already paid must still be reported as paid. Telling
 * somebody whose card was charged that we have not seen their payment is the
 * worst thing this page can do.
 */
export async function readPaymentState(
  supabase: SupabaseClient,
  reference: string
): Promise<FinalizeOutcome | null> {
  const order = await findOrderByReference(supabase, reference);
  if (!order) return null;

  return order.payment_verified === true
    ? { status: 'already_paid', orderNumber: order.order_number, orderId: order.id }
    : null;
}

export async function finalizePayment(
  supabase: SupabaseClient,
  payment: VerifiedPayment
): Promise<FinalizeOutcome> {
  if (payment.status !== 'success') return { status: 'not_paid' };

  const order = await findOrderByReference(supabase, payment.reference);
  if (!order) {
    console.error(`Paid transaction ${payment.reference} matches no order.`);
    return { status: 'order_not_found' };
  }

  // The idempotency guard, and it is a fact rather than a flag maintained for
  // this purpose: if the order is already marked paid there is nothing to do,
  // however many times the webhook fires.
  if (order.payment_verified === true) {
    return { status: 'already_paid', orderNumber: order.order_number, orderId: order.id };
  }

  const expectedKobo = Math.round(order.total_amount * KOBO_PER_NAIRA);
  if (payment.amountKobo !== expectedKobo) {
    console.error(
      `Amount mismatch on ${order.order_number}: charged ${payment.amountKobo} kobo, order is ${expectedKobo}.`
    );
    return {
      status: 'amount_mismatch',
      orderNumber: order.order_number,
      orderId: order.id,
      expected: expectedKobo,
      paid: payment.amountKobo,
    };
  }

  // Recorded before the transition, so that even if the transition fails
  // (a mail server, a stock error) the money is not lost from the record and
  // the retry sees an order that is already paid.
  const { error } = await supabase
    .from('orders')
    .update({
      payment_verified: true,
      paid_at: payment.paidAt ?? new Date().toISOString(),
      payment_channel: payment.channel,
      payment_reference: payment.reference,
    })
    .eq('id', order.id);

  if (error) {
    console.error(`Could not record payment for ${order.order_number}:`, error.message);
    throw new Error(error.message);
  }

  // Already there — a shopkeeper confirmed it by hand while the webhook was in
  // flight. The money is now recorded; nothing else to do.
  if (order.status === 'confirmed') {
    return { status: 'confirmed', orderNumber: order.order_number, orderId: order.id };
  }

  const transition = await applyOrderStatusTransition(supabase, order.id, 'confirmed', {
    paymentVerified: true,
    notificationMessage:
      'We have received your payment and your order is confirmed. We will let you know as soon as it ships.',
  });

  if (!transition.success) {
    // The payment stands recorded either way. This is the shop's problem to
    // finish, not the customer's to retry.
    console.error(`Payment recorded but confirmation failed for ${order.order_number}: ${transition.error}`);
  }

  return { status: 'confirmed', orderNumber: order.order_number, orderId: order.id };
}
