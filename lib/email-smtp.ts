// lib/email-smtp.ts - the SMTP transport, kept as a fallback.
//
// This was the only transport. It is now what runs when RESEND_API_KEY is
// unset, so a deployment that has not moved yet keeps sending rather than
// going silent the moment the primary changed — and a wrong or expired Resend
// key cannot take order confirmations down on its own.
//
// Nothing new should be built on it. It cannot authenticate the shop's domain,
// it caps out at a few hundred messages a day on Gmail, and a bounce after the
// handshake is invisible to it.
import nodemailer from 'nodemailer';
import { classifyEmailError, isEmailConfigured } from './email-failure';
import type { EmailSendResult } from './email-result';
import { type EmailStream, senderFor } from './email-streams';

export { isEmailConfigured as isSmtpConfigured };

const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

export interface SmtpSendInput {
  to?: string;
  bcc?: string[];
  subject: string;
  html: string;
  stream: EmailStream;
}

export async function sendViaSmtp({
  to,
  bcc,
  subject,
  html,
  stream,
}: SmtpSendInput): Promise<EmailSendResult> {
  if (!isEmailConfigured()) {
    return { success: false, reason: 'not_configured', detail: 'EMAIL_USER and EMAIL_PASS are not set.' };
  }

  try {
    const info = await createTransporter().sendMail({
      // senderFor() falls back to EMAIL_FROM/EMAIL_USER, so this is the same
      // From header this transport always used.
      from: senderFor(stream),
      ...(to ? { to } : {}),
      // BCC for a bulk send, so recipients cannot see each other.
      ...(bcc?.length ? { bcc: bcc.join(',') } : {}),
      subject,
      html,
    });

    const rejected = (info.rejected ?? []).map(String);
    if (rejected.length > 0) {
      console.warn(`SMTP: recipients refused by the receiving server: ${rejected.join(', ')}`);
    }

    return { success: true, messageId: info.messageId, rejected };
  } catch (error) {
    const failure = classifyEmailError(error);
    console.error(`SMTP send failed (${failure.reason}): ${failure.detail}`);
    return { success: false, ...failure };
  }
}

/** Opens a connection and authenticates without sending. Used by the health
 *  check, which is the only caller that wants to know the transport works
 *  without producing a message. */
export async function verifySmtp() {
  try {
    await createTransporter().verify();
    return { success: true, message: 'SMTP connection verified' };
  } catch (error) {
    const failure = classifyEmailError(error);
    console.error(`SMTP connection test failed (${failure.reason}): ${failure.detail}`);
    return { success: false, ...failure };
  }
}
