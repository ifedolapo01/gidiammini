/**
 * COMMERCE layer — why money went back out.
 *
 * order_refunds.reason_code is NOT NULL, unlike order_payments.reason_code,
 * and this is the list it is drawn from. The reason a refund must carry one is
 * that the aggregate over this column is the only place a shop finds out what
 * it is repeatedly paying for: a run of 'item_faulty' against one product is a
 * supplier problem, the same run against one courier is a handling problem,
 * and neither is visible from a column of amounts.
 *
 * Kept apart from cancellation-reasons.ts even though the two overlap, because
 * they answer different questions and diverge immediately. An order can be
 * refunded without being cancelled (a partial refund on a delivered order that
 * arrived short) and cancelled without being refunded (never paid for).
 */

export const REFUND_CODES = [
  'order_cancelled',
  'item_unavailable',
  'item_faulty',
  'wrong_item_sent',
  'not_delivered',
  'overpayment',
  'duplicate_payment',
  'goodwill',
  'other',
] as const;

export type RefundCode = (typeof REFUND_CODES)[number];

export interface RefundReason {
  code: RefundCode;
  /** What the admin picks. */
  label: string;
  /** Shown under the label on the picker. */
  hint: string;
  /** The sentence the customer reads when a notification is sent. */
  customerMessage: string;
  /**
   * True where the refund is normally the whole order rather than part of it.
   * The form uses it to pre-fill the amount; it never constrains what can be
   * entered, because "normally" is not "always".
   */
  usuallyFull?: boolean;
}

export const REFUND_REASONS: readonly RefundReason[] = [
  {
    code: 'order_cancelled',
    label: 'Order was cancelled',
    hint: 'The order will not be fulfilled and had already been paid for.',
    customerMessage: 'This is the refund for your cancelled order.',
    usuallyFull: true,
  },
  {
    code: 'item_unavailable',
    label: 'An item was unavailable',
    hint: 'Part of the order could not be supplied and was removed.',
    customerMessage:
      'One of the items on your order was not available, so we have refunded what you paid for it.',
  },
  {
    code: 'item_faulty',
    label: 'Item arrived faulty',
    hint: 'Damaged, defective, or not as described.',
    customerMessage:
      'We are sorry the item did not arrive in the condition it should have. This is the refund for it.',
  },
  {
    code: 'wrong_item_sent',
    label: 'We sent the wrong item',
    hint: 'Wrong size, colour or product left the shop.',
    customerMessage:
      'We are sorry we sent the wrong item. This is the refund for it.',
  },
  {
    code: 'not_delivered',
    label: 'Parcel never arrived',
    hint: 'Lost by the courier, or returned undelivered.',
    customerMessage:
      'Your parcel did not reach you, so we have refunded this order in full.',
    usuallyFull: true,
  },
  {
    code: 'overpayment',
    label: 'Customer overpaid',
    hint: 'More money arrived than the order was for.',
    customerMessage:
      'You transferred more than this order came to, so we have sent the difference back.',
  },
  {
    code: 'duplicate_payment',
    label: 'Paid twice',
    hint: 'The same order was paid for more than once.',
    customerMessage:
      'This order was paid for twice, so we have sent the second payment back to you.',
  },
  {
    code: 'goodwill',
    label: 'Goodwill',
    hint: 'A gesture rather than an entitlement — late delivery, poor service.',
    customerMessage:
      'We have refunded part of this order as an apology for the trouble it caused you.',
  },
  {
    code: 'other',
    label: 'Something else',
    hint: 'Write it yourself — the note is kept on the order.',
    customerMessage: 'We have issued a refund on this order.',
  },
];

/** The ground behind a code, or undefined for one this build predates. */
export function findRefundReason(code: string | null | undefined): RefundReason | undefined {
  return REFUND_REASONS.find((reason) => reason.code === code);
}

/** True when `value` is a ground this deployment knows. */
export function isRefundCode(value: unknown): value is RefundCode {
  return typeof value === 'string' && (REFUND_CODES as readonly string[]).includes(value);
}

/** Human label for a code, falling back to the raw value. */
export function refundLabel(code: string | null | undefined): string {
  return findRefundReason(code)?.label ?? (code || 'Unspecified');
}

/** What the customer is told. The admin's note is appended, never substituted
 * — same rule as cancellationMessage() and rejectionMessage(). */
export function refundMessage(code: string | null | undefined, note?: string | null): string {
  const reason = findRefundReason(code) ?? findRefundReason('other')!;
  const detail = note?.trim();
  return detail ? `${reason.customerMessage}\n\n${detail}` : reason.customerMessage;
}

/** Refund statuses, in the order a refund moves through them. */
export const REFUND_STATUSES = ['pending', 'completed', 'failed'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export function isRefundStatus(value: unknown): value is RefundStatus {
  return typeof value === 'string' && (REFUND_STATUSES as readonly string[]).includes(value);
}

/** How the money goes back. Mirrors order_refunds.method's CHECK. */
export const REFUND_METHODS = ['transfer', 'paystack', 'cash', 'pos', 'store_credit'] as const;
export type RefundMethod = (typeof REFUND_METHODS)[number];

export function isRefundMethod(value: unknown): value is RefundMethod {
  return typeof value === 'string' && (REFUND_METHODS as readonly string[]).includes(value);
}

export const REFUND_METHOD_LABELS: Record<RefundMethod, string> = {
  transfer: 'Bank transfer',
  paystack: 'Paystack reversal',
  cash: 'Cash',
  pos: 'POS',
  store_credit: 'Store credit',
};
