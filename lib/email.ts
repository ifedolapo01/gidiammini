// lib/email.ts - shared SMTP transport.
//
// Every send returns a named failure reason rather than a generic string, so
// callers can tell an operator whether the problem is configuration, the
// recipient's address, or the mail server.
import nodemailer from 'nodemailer';
import { classifyEmailError, isEmailConfigured } from './email-failure';
import type { DeliveryFailureReason } from './notifications/delivery';

export type EmailSendResult =
  | {
      success: true;
      messageId?: string;
      /**
       * Recipients the receiving server refused during the SMTP conversation.
       *
       * The only bounce this transport can report, and it reports it
       * synchronously: a hard rejection at handshake, before the message is
       * queued. Everything that goes wrong afterwards — a mailbox that fills
       * up, a deferral that gives up at 3am, a spam complaint — is invisible
       * to SMTP and needs a provider with webhooks. See migration
       * 20260906140000.
       *
       * `success` stays true when some recipients were accepted and others
       * refused, which is what nodemailer reports and what actually happened.
       * The caller decides whether a partial send counts.
       */
      rejected?: string[];
    }
  | { success: false; reason: DeliveryFailureReason; detail: string };

// Create a reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

export async function sendOrderEmail(to: string, subject: string, html: string): Promise<EmailSendResult> {
  if (!isEmailConfigured()) {
    return { success: false, reason: 'not_configured', detail: 'EMAIL_USER and EMAIL_PASS are not set.' };
  }

  if (!to?.trim()) {
    return { success: false, reason: 'no_recipient', detail: 'No recipient address given.' };
  }

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"GidiamMini Store" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    const rejected = (info.rejected ?? []).map(String);
    if (rejected.length > 0) {
      console.warn(`⚠️  Email to ${to} refused by the receiving server: ${rejected.join(', ')}`);
    } else {
      console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    }
    return { success: true, messageId: info.messageId, rejected };
  } catch (error) {
    const failure = classifyEmailError(error);
    console.error(`Email to ${to} failed (${failure.reason}): ${failure.detail}`);
    return { success: false, ...failure };
  }
}

// New function to send admin notifications
export async function sendAdminNotification(subject: string, html: string): Promise<EmailSendResult> {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
  if (!adminEmail) {
    console.warn('No admin email configured (set ADMIN_EMAIL or EMAIL_USER)');
    return { success: false, reason: 'no_recipient', detail: 'ADMIN_EMAIL and EMAIL_USER are both unset.' };
  }

  return sendOrderEmail(adminEmail, subject, html);
}

// Function to send email to multiple recipients
export async function sendBulkEmail(recipients: string[], subject: string, html: string): Promise<EmailSendResult> {
  if (!isEmailConfigured()) {
    return { success: false, reason: 'not_configured', detail: 'EMAIL_USER and EMAIL_PASS are not set.' };
  }

  if (recipients.length === 0) {
    return { success: false, reason: 'no_recipient', detail: 'No recipients given.' };
  }

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"GidiamMini Store" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      bcc: recipients.join(','), // Use BCC for privacy
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    const rejected = (info.rejected ?? []).map(String);
    console.log(
      `✅ Bulk email accepted for ${recipients.length - rejected.length} of ${recipients.length} recipients: ${info.messageId}`
    );
    return { success: true, messageId: info.messageId, rejected };
  } catch (error) {
    const failure = classifyEmailError(error);
    console.error(`Bulk email to ${recipients.length} recipients failed (${failure.reason}): ${failure.detail}`);
    return { success: false, ...failure };
  }
}

// Test email connection
export async function testEmailConnection() {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email server connection verified');
    return { success: true, message: 'Email server connection verified' };
  } catch (error) {
    const failure = classifyEmailError(error);
    console.error(`Email connection test failed (${failure.reason}): ${failure.detail}`);
    return { success: false, ...failure };
  }
}