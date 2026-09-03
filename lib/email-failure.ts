/**
 * Turns a nodemailer error into one of the shared delivery failure reasons.
 *
 * Without this, every email problem was reported as `provider_error` and the
 * admin saw the same "Email failed to send" whether the app password was
 * wrong, the customer's address was malformed, or the network was blocking
 * the SMTP port. Those need different actions from whoever reads the toast,
 * so they get different words.
 *
 * The reason vocabulary lives in lib/notifications/delivery.ts so email and
 * SMS describe themselves the same way.
 */
import type { DeliveryFailureReason } from './notifications/delivery';

export interface EmailFailure {
  reason: DeliveryFailureReason;
  detail: string;
}

/** True when SMTP credentials are present. Lets a caller report the channel
 * honestly without making a doomed connection first. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_USER?.trim() && process.env.EMAIL_PASS?.trim());
}

/** SMTP replies in the 5xx range that are about the address, not about us. */
function isRecipientRejection(responseCode: unknown): boolean {
  return typeof responseCode === 'number' && [510, 511, 513, 550, 553].includes(responseCode);
}

export function classifyEmailError(error: unknown): EmailFailure {
  if (!isEmailConfigured()) {
    return { reason: 'not_configured', detail: 'EMAIL_USER and EMAIL_PASS are not set.' };
  }

  const err = error as { code?: string; responseCode?: number; message?: string } | null;
  const code = err?.code;
  // `??` would let an error with an empty message through as an empty detail,
  // which reads as "no explanation" in a log line. Fall back on any blank.
  const message = err?.message?.trim() || 'unknown error';

  // Credentials exist but the server refused them — still a configuration
  // problem the operator has to fix, not a transient send failure.
  if (code === 'EAUTH') {
    return { reason: 'not_configured', detail: `SMTP rejected the credentials: ${message}` };
  }

  // EENVELOPE covers a malformed or refused to/from address.
  if (code === 'EENVELOPE' || isRecipientRejection(err?.responseCode)) {
    return { reason: 'invalid_recipient', detail: message };
  }

  if (code === 'ESOCKET' || code === 'ECONNECTION' || code === 'ETIMEDOUT') {
    return { reason: 'provider_error', detail: `could not reach the mail server: ${message}` };
  }

  return { reason: 'provider_error', detail: message };
}
