// lib/notifications/index.ts - orchestration only.
//
// Every function here returns a DeliveryOutcome saying which channels actually
// delivered and why the others didn't, rather than a bare success flag. The old
// shape pushed 'sms' onto a delivered list on the word of a stub that never
// sent anything.
import { sendOrderEmail, type EmailSendResult } from '@/lib/email';
import type { DeliveryOutcome, DeliveryFailure } from './delivery';
import { buildStatusEmail } from './templates/status-email';
import { buildCustomEmail } from './templates/custom-email';
import { buildOrderReceivedEmail } from './templates/order-received-email';
import { sendStatusSMS, sendCustomSMS } from './sms';

// Verification outcomes live in their own module — see payment-notices.ts.
// Re-exported here so callers still have one place to import a notification
// from, which is what this barrel is for.
export {
  sendPaymentShortfallNotice,
  sendPaymentRejectedNotice,
  type PaymentOutcomeParams,
} from './payment-notices';

interface OrderStatusUpdateParams {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  oldStatus: string;
  newStatus: string;
  customMessage?: string;
  /** Real, order-specific delivery/pickup timing text — only meaningful for 'confirmed'. */
  estimatedDeliveryText?: string;
}

interface CustomNotificationParams {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  message: string;
  viaEmail: boolean;
  viaSMS: boolean;
}

export async function sendOrderStatusUpdate(params: OrderStatusUpdateParams): Promise<DeliveryOutcome> {
  const { orderNumber, customerName, customerEmail, customerPhone, newStatus, customMessage, estimatedDeliveryText } = params;

  const delivered: DeliveryOutcome['delivered'] = [];
  const failed: DeliveryFailure[] = [];

  if (!customerEmail) {
    failed.push({ channel: 'email', reason: 'no_recipient' });
  } else {
    const email = await sendStatusEmailNotification({
      orderNumber, customerName, customerEmail, newStatus, customMessage, estimatedDeliveryText,
    });
    if (email.success) delivered.push('email');
    else failed.push({ channel: 'email', reason: email.reason, detail: email.detail });
  }

  if (!customerPhone) {
    failed.push({ channel: 'sms', reason: 'no_recipient' });
  } else {
    const sms = await sendStatusSMS({ customerPhone, orderNumber, newStatus, customMessage });
    if (sms.success) delivered.push('sms');
    else failed.push({ channel: 'sms', reason: sms.reason, detail: sms.detail });
  }

  return { delivered, failed };
}

export async function sendCustomNotification(params: CustomNotificationParams): Promise<DeliveryOutcome> {
  const { orderNumber, customerName, customerEmail, customerPhone, message, viaEmail, viaSMS } = params;

  const delivered: DeliveryOutcome['delivered'] = [];
  const failed: DeliveryFailure[] = [];

  if (!viaEmail) {
    failed.push({ channel: 'email', reason: 'not_requested' });
  } else if (!customerEmail) {
    failed.push({ channel: 'email', reason: 'no_recipient' });
  } else {
    const email = await sendCustomEmailNotification({ orderNumber, customerName, customerEmail, message });
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

interface OrderReceivedParams {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
}

/** Sent right after checkout, before any admin action — gives the customer
 * their order number and a tracking link immediately, rather than waiting
 * until an admin confirms/updates the order. Email-only, matching how
 * customers reach the tracker without an account. */
export async function sendOrderReceivedEmail(params: OrderReceivedParams): Promise<EmailSendResult> {
  const { customerEmail, ...templateParams } = params;

  if (!customerEmail) {
    return { success: false, reason: 'no_recipient', detail: 'No customer email on the order.' };
  }

  try {
    const { subject, html } = buildOrderReceivedEmail(templateParams);
    return await sendOrderEmail(customerEmail, subject, html);
  } catch (error) {
    console.error('Order-received email template error:', error);
    return { success: false, reason: 'provider_error', detail: 'Could not build the email.' };
  }
}

// Email senders - build the template, then send via lib/email.ts's shared transporter
async function sendStatusEmailNotification(params: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  newStatus: string;
  customMessage?: string;
  estimatedDeliveryText?: string;
}): Promise<EmailSendResult> {
  const { customerEmail, ...templateParams } = params;

  try {
    const { subject, html } = buildStatusEmail(templateParams);
    return await sendOrderEmail(customerEmail, subject, html);
  } catch (error) {
    // A template that throws is our bug, not the mail server's.
    console.error('Status email template error:', error);
    return { success: false, reason: 'provider_error', detail: 'Could not build the email.' };
  }
}

async function sendCustomEmailNotification(params: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  message: string;
}): Promise<EmailSendResult> {
  const { customerEmail, ...templateParams } = params;

  try {
    const { subject, html } = buildCustomEmail(templateParams);
    return await sendOrderEmail(customerEmail, subject, html);
  } catch (error) {
    console.error('Custom email template error:', error);
    return { success: false, reason: 'provider_error', detail: 'Could not build the email.' };
  }
}
