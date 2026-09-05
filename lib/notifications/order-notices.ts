/**
 * COMMERCE layer — what an amendment or a refund tells the customer.
 *
 * Split out of notifications/index.ts for the same reason payment-notices.ts
 * was: the barrel is at its size limit, and these two share a shape and a
 * reason for existing that the status and custom senders do not.
 *
 * Email-only, deliberately. Both messages are a list of changes and a set of
 * figures — an edited order's new breakdown, a refund's amount and reference —
 * and neither survives being cut to SMS length. A status change is one word
 * and belongs on both channels; "we removed the yellow one, added two blue,
 * and you now owe 3,500 less" is not a text message.
 */
import { sendOrderEmail, type EmailSendResult } from '@/lib/email';
import { buildOrderAmendedEmail } from './templates/order-amended-email';
import { buildRefundEmail } from './templates/refund-email';

export interface OrderAmendedParams {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  /** One sentence per change — see describeLineChange(). */
  changes: string[];
  itemsSubtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  discountReason?: string | null;
  totalAmount: number;
  previousTotal: number;
  amountPaid: number;
  note?: string | null;
}

export interface RefundNoticeParams {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  orderTotal: number;
  refundedTotal: number;
  /** True once the money has actually left. */
  settled: boolean;
  reasonCode?: string | null;
  note?: string | null;
  reference?: string | null;
  methodLabel?: string | null;
}

/** An order's contents or total changed after the customer placed it. */
export async function sendOrderAmendedNotice(params: OrderAmendedParams): Promise<EmailSendResult> {
  const { customerEmail, ...rest } = params;

  if (!customerEmail) {
    return { success: false, reason: 'no_recipient', detail: 'No customer email on the order.' };
  }

  try {
    const { subject, html } = buildOrderAmendedEmail(rest);
    return await sendOrderEmail(customerEmail, subject, html);
  } catch (error) {
    // A template that throws is our bug, not the mail server's.
    console.error('Order amended email template error:', error);
    return { success: false, reason: 'provider_error', detail: 'Could not build the email.' };
  }
}

/** Money is going back, or has gone. */
export async function sendRefundNotice(params: RefundNoticeParams): Promise<EmailSendResult> {
  const { customerEmail, ...rest } = params;

  if (!customerEmail) {
    return { success: false, reason: 'no_recipient', detail: 'No customer email on the order.' };
  }

  try {
    const { subject, html } = buildRefundEmail(rest);
    return await sendOrderEmail(customerEmail, subject, html);
  } catch (error) {
    console.error('Refund email template error:', error);
    return { success: false, reason: 'provider_error', detail: 'Could not build the email.' };
  }
}
