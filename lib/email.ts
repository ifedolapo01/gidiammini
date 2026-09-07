// lib/email.ts - the app's only email entry point.
//
// Picks a transport and labels the stream; the transports themselves live in
// lib/email-resend.ts (primary) and lib/email-smtp.ts (fallback). Every send
// returns a named failure reason rather than a generic string, so callers can
// tell an operator whether the problem is configuration, the recipient's
// address, or the provider.
//
// Resend runs whenever RESEND_API_KEY is set, which is the intended
// configuration. SMTP is what a deployment that has not been given a key yet
// falls back to — see lib/email-smtp.ts for why nothing new should use it.
import { isResendConfigured, sendViaResend } from './email-resend';
import { isSmtpConfigured, sendViaSmtp, verifySmtp } from './email-smtp';
import type { EmailSendResult } from './email-result';
import type { EmailStream } from './email-streams';

export type { EmailSendResult } from './email-result';
export type { EmailStream } from './email-streams';

export interface SendOptions {
  /**
   * Which reputation this message spends. Defaults to 'transactional', because
   * that is what all but two callers are and a mislabelled promotional send is
   * the one that does damage — see lib/email-streams.ts.
   */
  stream?: EmailStream;
}

/** True when either transport can send. Callers use it to report the channel
 *  honestly rather than attempting a doomed send first. */
export function isEmailConfigured(): boolean {
  return isResendConfigured() || isSmtpConfigured();
}

async function send(
  input: { to?: string; bcc?: string[]; subject: string; html: string; stream: EmailStream }
): Promise<EmailSendResult> {
  if (isResendConfigured()) {
    return sendViaResend({
      // Resend requires a recipient; a bulk send addresses everyone by bcc and
      // puts the sender in `to`, which is the conventional way to do it.
      to: input.to ?? [],
      bcc: input.bcc,
      subject: input.subject,
      html: input.html,
      stream: input.stream,
    });
  }

  return sendViaSmtp(input);
}

/**
 * One message to one recipient.
 *
 * Named for the first thing it sent and now used for every single-recipient
 * message in the app — order updates, password resets, admin invitations,
 * stock alerts, review invitations. Renaming it would touch twenty files to
 * say nothing new.
 */
export async function sendOrderEmail(
  to: string,
  subject: string,
  html: string,
  options: SendOptions = {}
): Promise<EmailSendResult> {
  if (!isEmailConfigured()) {
    return {
      success: false,
      reason: 'not_configured',
      detail: 'No email transport configured: set RESEND_API_KEY.',
    };
  }

  if (!to?.trim()) {
    return { success: false, reason: 'no_recipient', detail: 'No recipient address given.' };
  }

  return send({ to, subject, html, stream: options.stream ?? 'transactional' });
}

/** A message to whoever runs the shop. Always transactional: it is mail the
 *  operator needs, not mail anyone opted into. */
export async function sendAdminNotification(subject: string, html: string): Promise<EmailSendResult> {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
  if (!adminEmail) {
    console.warn('No admin email configured (set ADMIN_EMAIL or EMAIL_USER)');
    return { success: false, reason: 'no_recipient', detail: 'ADMIN_EMAIL and EMAIL_USER are both unset.' };
  }

  return sendOrderEmail(adminEmail, subject, html);
}

/**
 * One message to many recipients, addressed by BCC so they cannot see each
 * other.
 *
 * Marketing by default — this is the segment-campaign path, and there is no
 * transactional reason to mail five hundred people at once.
 */
export async function sendBulkEmail(
  recipients: string[],
  subject: string,
  html: string,
  options: SendOptions = {}
): Promise<EmailSendResult> {
  if (!isEmailConfigured()) {
    return {
      success: false,
      reason: 'not_configured',
      detail: 'No email transport configured: set RESEND_API_KEY.',
    };
  }

  if (recipients.length === 0) {
    return { success: false, reason: 'no_recipient', detail: 'No recipients given.' };
  }

  const result = await send({
    bcc: recipients,
    subject,
    html,
    stream: options.stream ?? 'marketing',
  });

  if (result.success) {
    const refused = result.rejected?.length ?? 0;
    console.log(`Bulk email accepted for ${recipients.length - refused} of ${recipients.length} recipients`);
  }

  return result;
}

/**
 * Whether mail can go out at all, for the health check.
 *
 * Resend has no equivalent of an SMTP handshake, and the endpoints that would
 * prove a key works (domains, API keys) need broader permissions than a
 * send-only key should have — asking for them to satisfy a health check would
 * make the key more dangerous than the check is worth. So a Resend deployment
 * reports on configuration; SMTP still gets the real connection test.
 */
export async function testEmailConnection() {
  if (isResendConfigured()) {
    return { success: true, message: 'Resend API key configured' };
  }

  if (!isSmtpConfigured()) {
    return {
      success: false,
      reason: 'not_configured' as const,
      detail: 'No email transport configured: set RESEND_API_KEY.',
      error: 'No email transport configured: set RESEND_API_KEY.',
    };
  }

  return verifySmtp();
}
