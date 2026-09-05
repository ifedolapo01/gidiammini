/**
 * COMMERCE layer — what a payment-verification outcome tells the customer.
 *
 * Split out of notifications/index.ts rather than added to it: that file is
 * the barrel every notification is imported from and was already at its size
 * limit, and these two share a parameter shape and a reason for existing that
 * the status/custom senders do not.
 *
 * Email-only, unlike a status change. Both messages turn on a figure and an
 * instruction — "transfer the balance of N", "upload a clearer receipt showing
 * the reference" — and neither survives being cut to an SMS length. A customer
 * who has to act needs the whole sentence.
 *
 * A fully verified payment does not come through here at all: it confirms the
 * order, and the confirmation notification already says so on both channels.
 */
import { sendOrderEmail, type EmailSendResult } from '@/lib/email';
import { buildPaymentShortfallEmail } from './templates/payment-shortfall-email';
import { buildPaymentRejectedEmail } from './templates/payment-rejected-email';

export interface PaymentOutcomeParams {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  /** Credited in total against this order, after this decision. */
  receivedTotal: number;
  /** Credited by this decision alone. 0 for a rejection. */
  received: number;
  outstanding: number;
  /** A PaymentRejectionCode, for a rejection. */
  reasonCode?: string | null;
  /** The verifier's own words, where they wrote any. */
  note?: string | null;
}

/** Some money arrived, but not all of it. */
export async function sendPaymentShortfallNotice(params: PaymentOutcomeParams): Promise<EmailSendResult> {
  const { customerEmail, ...rest } = params;

  if (!customerEmail) {
    return { success: false, reason: 'no_recipient', detail: 'No customer email on the order.' };
  }

  try {
    const { subject, html } = buildPaymentShortfallEmail({
      orderNumber: rest.orderNumber,
      customerName: rest.customerName,
      expected: rest.totalAmount,
      received: rest.received,
      receivedTotal: rest.receivedTotal,
      outstanding: rest.outstanding,
      note: rest.note,
    });
    return await sendOrderEmail(customerEmail, subject, html);
  } catch (error) {
    console.error('Payment shortfall email template error:', error);
    return { success: false, reason: 'provider_error', detail: 'Could not build the email.' };
  }
}

/** Nothing is being credited, and the customer has one step to take. */
export async function sendPaymentRejectedNotice(params: PaymentOutcomeParams): Promise<EmailSendResult> {
  const { customerEmail, ...rest } = params;

  if (!customerEmail) {
    return { success: false, reason: 'no_recipient', detail: 'No customer email on the order.' };
  }

  try {
    const { subject, html } = buildPaymentRejectedEmail({
      orderNumber: rest.orderNumber,
      customerName: rest.customerName,
      totalAmount: rest.totalAmount,
      receivedTotal: rest.receivedTotal,
      reasonCode: rest.reasonCode ?? null,
      note: rest.note,
    });
    return await sendOrderEmail(customerEmail, subject, html);
  } catch (error) {
    console.error('Payment rejected email template error:', error);
    return { success: false, reason: 'provider_error', detail: 'Could not build the email.' };
  }
}
