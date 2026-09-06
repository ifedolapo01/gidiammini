// lib/notifications/index.ts - orchestration only.
//
// Every function here returns a DeliveryOutcome saying which channels actually
// delivered and why the others didn't, rather than a bare success flag. The old
// shape pushed 'sms' onto a delivered list on the word of a stub that never
// sent anything.
import type { EmailSendResult } from '@/lib/email';
import type { OrderTracking } from '@/lib/commerce/order-tracking';
import type { DeliveryOutcome, DeliveryFailure } from './delivery';
import type { NotificationContext } from './context';
import { buildOrderReceivedEmail } from './templates/order-received-email';
import { sendEmailAndLog, recordSkippedEmail } from './send';
import { sendStatusEmailNotification, sendCustomEmailNotification } from './order-emails';
import { sendStatusSMS, sendCustomSMS } from './sms';

export type { NotificationContext };

// Verification outcomes live in their own module — see payment-notices.ts.
// Re-exported here so callers still have one place to import a notification
// from, which is what this barrel is for.
export {
  sendPaymentShortfallNotice,
  sendPaymentRejectedNotice,
  type PaymentOutcomeParams,
} from './payment-notices';

// Amendments and refunds live in order-notices.ts for the same reason — see
// the header there.
export {
  sendOrderAmendedNotice,
  sendRefundNotice,
  type OrderAmendedParams,
  type RefundNoticeParams,
} from './order-notices';

interface OrderStatusUpdateParams extends NotificationContext {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  oldStatus: string;
  newStatus: string;
  customMessage?: string;
  /** Real, order-specific delivery/pickup timing text — only meaningful for 'confirmed'. */
  estimatedDeliveryText?: string;
  /** Courier and waybill. Only meaningful for 'shipped'; both channels ignore
   * it otherwise rather than each deciding for themselves. */
  tracking?: Partial<OrderTracking> | null;
}

interface CustomNotificationParams extends NotificationContext {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  message: string;
  viaEmail: boolean;
  viaSMS: boolean;
}

export async function sendOrderStatusUpdate(params: OrderStatusUpdateParams): Promise<DeliveryOutcome> {
  const {
    orderNumber, customerName, customerEmail, customerPhone, newStatus,
    customMessage, estimatedDeliveryText, tracking,
    orderId, customerId, actorId, resendOf,
  } = params;

  const context = { orderId, customerId, actorId, resendOf };

  const delivered: DeliveryOutcome['delivered'] = [];
  const failed: DeliveryFailure[] = [];

  if (!customerEmail) {
    failed.push({ channel: 'email', reason: 'no_recipient' });
    // Recorded, not merely skipped. "There was no address on the order" is the
    // most common answer to "why did they never hear from us", and it is the
    // one a system that only logs attempts can never give.
    await recordSkippedEmail({ kind: 'status_change', reason: 'no_recipient', orderId, customerId });
  } else {
    const email = await sendStatusEmailNotification({
      orderNumber, customerName, customerEmail, newStatus, customMessage, estimatedDeliveryText, tracking,
      ...context,
    });
    if (email.success) delivered.push('email');
    else failed.push({ channel: 'email', reason: email.reason, detail: email.detail });
  }

  if (!customerPhone) {
    failed.push({ channel: 'sms', reason: 'no_recipient' });
  } else {
    const sms = await sendStatusSMS({ customerPhone, orderNumber, newStatus, customMessage, tracking });
    if (sms.success) delivered.push('sms');
    else failed.push({ channel: 'sms', reason: sms.reason, detail: sms.detail });
  }

  return { delivered, failed };
}

export async function sendCustomNotification(params: CustomNotificationParams): Promise<DeliveryOutcome> {
  const {
    orderNumber, customerName, customerEmail, customerPhone, message, viaEmail, viaSMS,
    orderId, customerId, actorId, resendOf,
  } = params;

  const context = { orderId, customerId, actorId, resendOf };

  const delivered: DeliveryOutcome['delivered'] = [];
  const failed: DeliveryFailure[] = [];

  if (!viaEmail) {
    // Not logged: the admin deliberately did not tick email, and a timeline
    // full of "you chose not to send this" is noise over the sends that
    // happened.
    failed.push({ channel: 'email', reason: 'not_requested' });
  } else if (!customerEmail) {
    failed.push({ channel: 'email', reason: 'no_recipient' });
    await recordSkippedEmail({ kind: 'custom', reason: 'no_recipient', orderId, customerId });
  } else {
    const email = await sendCustomEmailNotification({ orderNumber, customerName, customerEmail, message, ...context });
    if (email.success) delivered.push('email');
    else failed.push({ channel: 'email', reason: email.reason, detail: email.detail });
  }

  if (!viaSMS) {
    failed.push({ channel: 'sms', reason: 'not_requested' });
  } else if (!customerPhone) {
    failed.push({ channel: 'sms', reason: 'no_recipient' });
  } else {
    const sms = await sendCustomSMS({ customerPhone, orderNumber, message });
    if (sms.success) delivered.push('sms');
    else failed.push({ channel: 'sms', reason: sms.reason, detail: sms.detail });
  }

  return { delivered, failed };
}

interface OrderReceivedParams extends NotificationContext {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
}

/** Sent right after checkout, before any admin action — gives the customer
 * their order number and a tracking link immediately, rather than waiting
 * until an admin confirms/updates the order. Email-only, matching how
 * customers reach the tracker without an account. */
export async function sendOrderReceivedEmail(params: OrderReceivedParams): Promise<EmailSendResult> {
  const { customerEmail, orderId, customerId, actorId, resendOf, ...templateParams } = params;

  if (!customerEmail) {
    await recordSkippedEmail({ kind: 'order_received', reason: 'no_recipient', orderId, customerId });
    return { success: false, reason: 'no_recipient', detail: 'No customer email on the order.' };
  }

  try {
    const { subject, html } = buildOrderReceivedEmail(templateParams);
    return await sendEmailAndLog({
      to: customerEmail, subject, html,
      kind: 'order_received', orderId, customerId, actorId, resendOf,
    });
  } catch (error) {
    console.error('Order-received email template error:', error);
    return { success: false, reason: 'provider_error', detail: 'Could not build the email.' };
  }
}
