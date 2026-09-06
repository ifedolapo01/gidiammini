/**
 * Send an email, and write down that we did. Server only.
 *
 * The single seam between lib/email.ts (which knows how to talk SMTP and
 * nothing about orders) and lib/notifications/log.ts (which knows what to
 * record and nothing about sending). Every notification that belongs on an
 * order's timeline goes through here instead of calling sendOrderEmail
 * directly, so the record cannot be forgotten by the next template somebody
 * adds.
 *
 * WHY THE RESULT SHAPE IS UNCHANGED
 *
 * It returns exactly what sendOrderEmail returns, plus the id of the row it
 * wrote. Every existing caller reads `success` and `reason` to decide what to
 * tell the operator, and a wrapper that changed that contract would be a
 * wrapper nobody adopts.
 */
import 'server-only';
import { sendOrderEmail, type EmailSendResult } from '@/lib/email';
import { recordNotification } from './log';
import type { NotificationKind } from './kinds';

export interface SendAndLogParams {
  to: string;
  subject: string;
  html: string;
  kind: NotificationKind;
  orderId?: string | null;
  customerId?: string | null;
  /** Set when an admin pressed Resend. */
  actorId?: string | null;
  /** The notification being repeated. */
  resendOf?: string | null;
}

export type SendAndLogResult = EmailSendResult & { notificationId: string | null };

export async function sendEmailAndLog(params: SendAndLogParams): Promise<SendAndLogResult> {
  const { to, subject, html, kind, orderId, customerId, actorId, resendOf } = params;

  const result = await sendOrderEmail(to, subject, html);

  // A recipient the receiving server refused outright. nodemailer still
  // reports success — the message was handed over and other recipients may
  // have been accepted — but for a single-recipient send a rejection is the
  // whole outcome, and recording it as 'sent' would be a lie the shop later
  // relies on.
  const hardBounced = result.success && (result.rejected?.length ?? 0) > 0;

  const notificationId = await recordNotification({
    channel: 'email',
    kind,
    recipient: to,
    subject,
    orderId,
    customerId,
    actorId,
    resendOf,
    status: !result.success ? 'failed' : hardBounced ? 'bounced' : 'sent',
    providerMessageId: result.success ? (result.messageId ?? null) : null,
    failureReason: result.success ? null : result.reason,
    failureDetail: result.success
      ? hardBounced
        ? `Refused by the receiving server: ${result.rejected!.join(', ')}`
        : null
      : result.detail,
  });

  return { ...result, notificationId };
}

/**
 * The same, for a message that was not sent at all.
 *
 * "No address on file" is the single most common reason a customer never got
 * anything, and it is the one a fire-and-forget system leaves no trace of —
 * the send is skipped by a guard clause long before any mail code runs. A
 * timeline that shows the gap is worth more than one that shows only the
 * attempts that reached SMTP.
 */
export async function recordSkippedEmail(params: {
  kind: NotificationKind;
  reason: 'no_recipient' | 'not_requested' | 'not_configured';
  orderId?: string | null;
  customerId?: string | null;
  subject?: string | null;
}): Promise<void> {
  await recordNotification({
    channel: 'email',
    kind: params.kind,
    // Not null: the column is NOT NULL because "who did you send it to" is the
    // question this table exists for, and a row with no answer needs to say so
    // in words rather than by being empty.
    recipient: '(none on file)',
    status: 'failed',
    subject: params.subject ?? null,
    orderId: params.orderId ?? null,
    customerId: params.customerId ?? null,
    failureReason: params.reason,
  });
}
