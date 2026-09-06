/**
 * The order emails: build a template, hand it to the logged sender.
 *
 * Split from index.ts, which is the orchestration barrel — it decides which
 * channels to try and assembles the DeliveryOutcome, while these two decide
 * what the message says. Both grew when every send started being written to
 * the notifications table, and one file doing both had outgrown the project's
 * line cap.
 *
 * A template that throws is our bug, not the mail server's, which is why each
 * of these catches around the build step and reports 'provider_error' rather
 * than taking the caller's request down with it.
 */
import 'server-only';
import type { EmailSendResult } from '@/lib/email';
import type { OrderTracking } from '@/lib/commerce/order-tracking';
import { buildStatusEmail } from './templates/status-email';
import { buildCustomEmail } from './templates/custom-email';
import { sendEmailAndLog } from './send';
import type { NotificationContext } from './context';

export async function sendStatusEmailNotification(params: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  newStatus: string;
  customMessage?: string;
  estimatedDeliveryText?: string;
  tracking?: Partial<OrderTracking> | null;
} & NotificationContext): Promise<EmailSendResult> {
  const { customerEmail, orderId, customerId, actorId, resendOf, ...templateParams } = params;

  try {
    const { subject, html } = buildStatusEmail(templateParams);
    return await sendEmailAndLog({
      to: customerEmail, subject, html,
      kind: 'status_change', orderId, customerId, actorId, resendOf,
    });
  } catch (error) {
    // A template that throws is our bug, not the mail server's.
    console.error('Status email template error:', error);
    return { success: false, reason: 'provider_error', detail: 'Could not build the email.' };
  }
}

export async function sendCustomEmailNotification(params: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  message: string;
} & NotificationContext): Promise<EmailSendResult> {
  const { customerEmail, orderId, customerId, actorId, resendOf, ...templateParams } = params;

  try {
    const { subject, html } = buildCustomEmail(templateParams);
    return await sendEmailAndLog({
      to: customerEmail, subject, html,
      kind: 'custom', orderId, customerId, actorId, resendOf,
    });
  } catch (error) {
    console.error('Custom email template error:', error);
    return { success: false, reason: 'provider_error', detail: 'Could not build the email.' };
  }
}
