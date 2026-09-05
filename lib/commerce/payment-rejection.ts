/**
 * COMMERCE layer — why a receipt was refused, and what the customer does next.
 *
 * A rejection that only says "rejected" moves the problem to the customer
 * without telling them how to solve it, so they message the shop and the shop
 * answers the same five questions every time. Each ground below therefore
 * carries the sentence the customer is emailed, written as an instruction
 * rather than a verdict.
 *
 * One vocabulary, three consumers: the picker on the verification screen, the
 * rejection email, and the reason_code stored on the payment row. Adding a
 * ground is one entry here.
 */

export const PAYMENT_REJECTION_CODES = [
  'not_received',
  'wrong_amount',
  'duplicate',
  'wrong_account',
  'unreadable',
  'not_a_receipt',
  'other',
] as const;

export type PaymentRejectionCode = (typeof PAYMENT_REJECTION_CODES)[number];

export interface PaymentRejectionReason {
  code: PaymentRejectionCode;
  /** What the verifier picks. Phrased as what they saw. */
  label: string;
  /** Shown under the label on the picker, so the right ground is chosen. */
  hint: string;
  /** Subject-line fragment, and the heading of the email. */
  headline: string;
  /** The customer's next step. One instruction, in the second person. */
  nextStep: string;
  /** True where the shop has to be involved before the customer can act — the
   *  email then says to contact the shop rather than to try again. */
  needsContact?: boolean;
}

export const PAYMENT_REJECTION_REASONS: readonly PaymentRejectionReason[] = [
  {
    code: 'not_received',
    label: 'No such payment in our account',
    hint: 'Checked the bank and nothing matching arrived.',
    headline: 'We could not find this payment',
    nextStep:
      'Please check with your bank that the transfer actually left your account. If it did, reply to this email with the full transaction details — the sending bank, the exact amount and the date — and we will trace it. If it did not, you can transfer again using the account details on your order.',
  },
  {
    code: 'wrong_amount',
    label: 'Amount does not match the receipt',
    hint: 'The figure on the image is not the figure that arrived.',
    headline: 'The amount on your receipt does not match what we received',
    nextStep:
      'Please send us a screenshot of the transfer straight from your banking app, showing the amount and the date. If you transferred a different amount than the order total, tell us and we will confirm the balance for you.',
  },
  {
    code: 'duplicate',
    label: 'Receipt already used on another order',
    hint: 'The same reference has been submitted before.',
    headline: 'This receipt has already been used',
    nextStep:
      'This payment reference is already recorded against an earlier order, so it cannot pay for this one too. Please make the transfer for this order and upload that receipt. If you believe this is a mistake, reply to this email with the reference and we will check it.',
  },
  {
    code: 'wrong_account',
    label: 'Paid into the wrong account',
    hint: 'The money went somewhere that is not ours.',
    headline: 'This payment went to a different account',
    nextStep:
      'The account on your receipt is not ours, so we have not received this money. Please contact your bank about recalling the transfer, then reply to this email and we will re-send our correct account details so your order can go ahead.',
    needsContact: true,
  },
  {
    code: 'unreadable',
    label: 'Receipt is unreadable',
    hint: 'Too blurred, cropped or dark to verify.',
    headline: 'We could not read your receipt',
    nextStep:
      'Please upload a clearer image showing the amount, the date, the account it was sent to and the transaction reference. A screenshot taken directly in your banking app is usually easiest to read.',
  },
  {
    code: 'not_a_receipt',
    label: 'Not a payment receipt',
    hint: 'The upload is something else entirely.',
    headline: 'The file you uploaded is not a payment receipt',
    nextStep:
      'Please upload the receipt or transfer confirmation for this order, showing the amount, the date and the transaction reference.',
  },
  {
    code: 'other',
    label: 'Something else',
    hint: 'Write the reason yourself — it is sent to the customer.',
    headline: 'We could not verify your payment',
    nextStep:
      'Please reply to this email with the details of your transfer — the sending bank, the exact amount, the date and the transaction reference — and we will look into it straight away.',
  },
];

/** The ground behind a code, or undefined for a code this build predates. */
export function findRejectionReason(
  code: string | null | undefined
): PaymentRejectionReason | undefined {
  return PAYMENT_REJECTION_REASONS.find((reason) => reason.code === code);
}

/** True when `value` is a ground this deployment knows. */
export function isPaymentRejectionCode(value: unknown): value is PaymentRejectionCode {
  return typeof value === 'string' && (PAYMENT_REJECTION_CODES as readonly string[]).includes(value);
}

/**
 * What the customer is told, for a rejection.
 *
 * `note` is the verifier's own sentence. It is appended rather than substituted
 * even for 'other', because the canonical next step is what makes the email
 * actionable and a hurried note rarely repeats it.
 */
export function rejectionMessage(
  code: string | null | undefined,
  note?: string | null
): { headline: string; nextStep: string; detail: string | null } {
  const reason = findRejectionReason(code) ?? findRejectionReason('other')!;
  const detail = note?.trim() ? note.trim() : null;

  return { headline: reason.headline, nextStep: reason.nextStep, detail };
}
