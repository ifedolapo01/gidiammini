/**
 * COMMERCE layer (server only) — telling the customer about a refund.
 *
 * Shared by the two moments that produce one: recording it (order-refunds.ts)
 * and settling it (refund-settlement.ts). Both send the same email with the
 * same figures and differ in one boolean, so a copy in each was a copy that
 * would eventually disagree about which amount to quote.
 *
 * Never throws and never fails its caller. By the time this runs the refund is
 * already recorded; failing the request over an email would leave the operator
 * believing nothing had happened when the money is committed.
 */
import 'server-only';
import { sendRefundNotice } from '@/lib/notifications';
import { REFUND_METHOD_LABELS, type RefundMethod } from './refund-reasons';

/** The order a refund belongs to, as much of it as the email needs. */
export interface RefundNotifyOrder {
  order_number: string;
  customer_name: string;
  customer_email: string;
  total_amount: number | null;
}

export interface RefundNotifyDetail {
  amount: number;
  /** Refunded against this order in total, this one included. */
  refundedTotal: number;
  /** True once the money has actually left. */
  settled: boolean;
  reasonCode: string;
  note: string | null;
  reference: string | null;
  method: string;
}

/** Returns whether the customer was actually reached. */
export async function announceRefund(
  order: RefundNotifyOrder,
  detail: RefundNotifyDetail
): Promise<boolean> {
  const sent = await sendRefundNotice({
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    amount: detail.amount,
    orderTotal: Number(order.total_amount ?? 0),
    refundedTotal: detail.refundedTotal,
    settled: detail.settled,
    reasonCode: detail.reasonCode,
    note: detail.note,
    reference: detail.reference,
    // Falls back to the raw value for a method a newer deployment introduced,
    // rather than sending an email with a blank where the method should be.
    methodLabel: REFUND_METHOD_LABELS[detail.method as RefundMethod] ?? detail.method,
  });

  if (!sent.success) {
    console.error(`Refund on ${order.order_number} recorded but not emailed: ${sent.detail}`);
  }

  return sent.success;
}
