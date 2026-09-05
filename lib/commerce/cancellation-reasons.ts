/**
 * COMMERCE layer — why an order was cancelled, and what the customer is told.
 *
 * Cancelling used to be a window.confirm. The order went away and the single
 * most valuable thing about it — why — went with it. A shop that cannot say
 * whether its cancellations are stockouts, unreachable buyers or its own
 * pricing mistakes cannot fix any of them, and those three call for completely
 * different fixes.
 *
 * Free text alone does not solve it: "no stock", "out of stock", "oos" and
 * "we don't have it" are four spellings of one answer and aggregate to
 * nothing. So a cancellation carries a code from this list *and* the
 * cancelling admin's own sentence. The code is what gets counted; the sentence
 * is what a person needed to say.
 *
 * One vocabulary, four consumers: the picker on the cancel dialog, the
 * customer's cancellation email, the reason_code stored on
 * order_status_history, and the breakdown read back off the order_cancellations
 * view. Adding a ground is one entry here.
 */

export const CANCELLATION_CODES = [
  'out_of_stock',
  'customer_changed_mind',
  'customer_unreachable',
  'payment_not_received',
  'duplicate_order',
  'undeliverable_address',
  'pricing_error',
  'suspected_fraud',
  'other',
] as const;

export type CancellationCode = (typeof CANCELLATION_CODES)[number];

/**
 * Who the ground points at.
 *
 * Not blame — a bookkeeping distinction. 'shop' cancellations are the ones the
 * business can act on directly and the ones that most deserve a goodwill
 * gesture; 'customer' ones are demand that was never real; 'neither' is noise.
 * Reporting them together would hide the only number worth watching.
 */
export type CancellationOrigin = 'shop' | 'customer' | 'neither';

export interface CancellationReason {
  code: CancellationCode;
  /** What the admin picks. Phrased as what happened. */
  label: string;
  /** Shown under the label, so the right ground is chosen rather than the first. */
  hint: string;
  origin: CancellationOrigin;
  /** The sentence the customer reads. Second person, no jargon, no blame. */
  customerMessage: string;
  /**
   * Whether money is normally owed back on this ground.
   *
   * Drives nothing on its own — the refund panel opens on any paid, cancelled
   * order — but it decides whether the UI *prompts* for one. A stockout that
   * was paid for and quietly not refunded is the single worst thing this
   * feature could allow to keep happening.
   */
  refundExpected: boolean;
  /** True where somebody has to explain in their own words for the record to
   * mean anything. The dialog then requires the free-text note. */
  requiresNote?: boolean;
}

export const CANCELLATION_REASONS: readonly CancellationReason[] = [
  {
    code: 'out_of_stock',
    label: 'We could not fulfil it',
    hint: 'The item is gone, damaged, or never arrived from the supplier.',
    origin: 'shop',
    customerMessage:
      'We are very sorry — we are not able to fulfil this order. The item is no longer available in the size or colour you chose.',
    refundExpected: true,
  },
  {
    code: 'customer_changed_mind',
    label: 'Customer changed their mind',
    hint: 'They asked to cancel, and nothing had shipped.',
    origin: 'customer',
    customerMessage:
      'We have cancelled this order as you asked. Nothing further is owed.',
    refundExpected: true,
  },
  {
    code: 'customer_unreachable',
    label: 'Could not reach the customer',
    hint: 'Calls and messages went unanswered, so delivery could not be arranged.',
    origin: 'customer',
    customerMessage:
      'We tried to reach you several times to arrange this order and could not get through, so we have had to cancel it. Please place a new order when you are ready and we will be glad to help.',
    refundExpected: true,
  },
  {
    code: 'payment_not_received',
    label: 'Payment never arrived',
    hint: 'The transfer was never made, or was refused and not replaced.',
    origin: 'customer',
    customerMessage:
      'We have cancelled this order because we did not receive payment for it. If you did pay, reply to this email with your transfer details and we will look into it straight away.',
    refundExpected: false,
  },
  {
    code: 'duplicate_order',
    label: 'Duplicate of another order',
    hint: 'The same items were ordered twice; the other one stands.',
    origin: 'neither',
    customerMessage:
      'This order was a duplicate, so we have cancelled it. Your other order is unaffected and is being processed as normal.',
    refundExpected: true,
    requiresNote: true,
  },
  {
    code: 'undeliverable_address',
    label: 'We cannot deliver there',
    hint: 'Outside every zone we serve, or the address could not be found.',
    origin: 'neither',
    customerMessage:
      'We are sorry — we are not able to deliver to the address on this order. If you have another address we can reach, or would like to collect instead, reply to this email and we will set that up.',
    refundExpected: true,
  },
  {
    code: 'pricing_error',
    label: 'Our price was wrong',
    hint: 'The listed price or delivery fee was a mistake on our side.',
    origin: 'shop',
    customerMessage:
      'We are sorry — the price shown on this order was listed in error, so we have had to cancel it. Please get in touch and we will do what we can to make it right.',
    refundExpected: true,
    requiresNote: true,
  },
  {
    code: 'suspected_fraud',
    label: 'Suspected fraud',
    hint: 'The payment or the buyer does not check out.',
    origin: 'shop',
    // Deliberately says nothing about the suspicion. Telling someone they are
    // suspected of fraud invites an argument the shop cannot win and warns
    // anyone who genuinely is.
    customerMessage:
      'We are unable to process this order and have cancelled it. Please contact us if you would like to discuss it.',
    refundExpected: false,
    requiresNote: true,
  },
  {
    code: 'other',
    label: 'Something else',
    hint: 'Write it yourself — the note is kept on the order.',
    origin: 'neither',
    customerMessage:
      'We have had to cancel this order. Please contact us if you have any questions and we will explain.',
    refundExpected: true,
    requiresNote: true,
  },
];

/** The ground behind a code, or undefined for one this build predates. */
export function findCancellationReason(
  code: string | null | undefined
): CancellationReason | undefined {
  return CANCELLATION_REASONS.find((reason) => reason.code === code);
}

/** True when `value` is a ground this deployment knows. */
export function isCancellationCode(value: unknown): value is CancellationCode {
  return typeof value === 'string' && (CANCELLATION_CODES as readonly string[]).includes(value);
}

/** Human label for a code, falling back to the raw value so an entry written
 * by a newer deployment still reads as something rather than as blank. */
export function cancellationLabel(code: string | null | undefined): string {
  return findCancellationReason(code)?.label ?? (code || 'No reason recorded');
}

/**
 * What the customer is told.
 *
 * The admin's note is appended rather than substituted: the canonical sentence
 * is the one that has been thought about, and a hurried note is rarely a
 * replacement for it. An empty note leaves the canonical sentence alone.
 */
export function cancellationMessage(
  code: string | null | undefined,
  note?: string | null
): string {
  const reason = findCancellationReason(code) ?? findCancellationReason('other')!;
  const detail = note?.trim();
  return detail ? `${reason.customerMessage}\n\n${detail}` : reason.customerMessage;
}
