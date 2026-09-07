// lib/email-resend.ts - the Resend transport, and how its errors map onto the
// shared failure vocabulary.
//
// The primary transport. Gmail SMTP caps sending at a few hundred messages a
// day, which a discount send to a growing subscriber list reaches quickly, and
// mail from a personal Gmail address cannot be authenticated for the shop's own
// domain — so order confirmations land in spam with no bounce data to explain
// why. Resend sends over an authenticated domain and reports what happened.
//
// lib/email-smtp.ts is kept as the fallback for a deployment with no
// RESEND_API_KEY set. lib/email.ts picks between them.
import { Resend } from 'resend';
import type { ErrorResponse } from 'resend';
import type { EmailSendResult } from './email-result';
import type { DeliveryFailureReason } from './notifications/delivery';
import { type EmailStream, senderFor, tagsFor } from './email-streams';

/** True when a Resend API key is present. The key is the whole configuration —
 *  there is no host, port or password to get wrong. */
export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/**
 * One client per key, built on first use rather than at module load.
 *
 * Constructing it at import time would throw in any environment without the
 * key — including the test run and `next build`, neither of which sends
 * anything. Keyed on the value so a changed key is picked up rather than
 * cached for the life of the process.
 */
let client: { key: string; resend: Resend } | null = null;

function getClient(key: string): Resend {
  if (client?.key !== key) client = { key, resend: new Resend(key) };
  return client.resend;
}

/**
 * Errors that mean an operator has to change something, not that a send should
 * be retried. Reported as `not_configured` so the admin UI says "fix the
 * setup" rather than "try again", which would never work.
 */
const CONFIGURATION_ERRORS = new Set<ErrorResponse['name']>([
  'missing_api_key',
  'invalid_api_key',
  'restricted_api_key',
  'invalid_access',
  'invalid_region',
  // The sending domain is not verified, or the address is not on it. The most
  // likely error on a first deploy, and squarely a configuration problem.
  'invalid_from_address',
  'security_error',
]);

/**
 * Errors about the message that was submitted. Mapped to `invalid_recipient`
 * because in this app the recipient is the only part of the payload that comes
 * from data rather than from code — subject and HTML are built by our own
 * templates, so a rejected payload is almost always a malformed address. The
 * detail carries Resend's own sentence for the cases where it is not.
 */
const PAYLOAD_ERRORS = new Set<ErrorResponse['name']>([
  'validation_error',
  'invalid_parameter',
  'missing_required_field',
  'invalid_attachment',
]);

export function classifyResendError(error: ErrorResponse): {
  reason: DeliveryFailureReason;
  detail: string;
} {
  const detail = error.message?.trim() || error.name || 'unknown error';

  if (CONFIGURATION_ERRORS.has(error.name)) return { reason: 'not_configured', detail };
  if (PAYLOAD_ERRORS.has(error.name)) return { reason: 'invalid_recipient', detail };

  // Quotas, rate limits, and Resend's own 5xx. All worth retrying later, none
  // fixable by the operator right now.
  return { reason: 'provider_error', detail };
}

export interface ResendSendInput {
  /** Visible recipients. Empty for a bulk send, which addresses everyone by bcc. */
  to: string | string[];
  bcc?: string[];
  subject: string;
  html: string;
  stream: EmailStream;
}

export async function sendViaResend({
  to,
  bcc,
  subject,
  html,
  stream,
}: ResendSendInput): Promise<EmailSendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return { success: false, reason: 'not_configured', detail: 'RESEND_API_KEY is not set.' };
  }

  const from = senderFor(stream);
  if (!from) {
    return {
      success: false,
      reason: 'not_configured',
      detail: 'No sender address: set RESEND_FROM_EMAIL.',
    };
  }

  try {
    const { data, error } = await getClient(key).emails.send({
      from,
      to,
      ...(bcc?.length ? { bcc } : {}),
      subject,
      html,
      tags: tagsFor(stream),
    });

    if (error) {
      const failure = classifyResendError(error);
      console.error(`Resend refused a ${stream} message (${failure.reason}): ${failure.detail}`);
      return { success: false, ...failure };
    }

    // `rejected` is deliberately empty — see lib/email-result.ts. Resend has
    // accepted the message; what happens next arrives by webhook.
    return { success: true, messageId: data?.id, rejected: [] };
  } catch (error) {
    // A thrown error here is the network, not the API: Resend returns refusals
    // in `error` rather than throwing.
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`Could not reach Resend for a ${stream} message: ${detail}`);
    return { success: false, reason: 'provider_error', detail: `could not reach Resend: ${detail}` };
  }
}
