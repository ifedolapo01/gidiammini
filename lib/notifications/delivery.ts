/**
 * What actually happened when we tried to notify a customer.
 *
 * This exists because the previous code couldn't answer that question. The SMS
 * layer was a stub that logged and returned `{ success: true }`, so 'sms' was
 * pushed into the delivered list for a message that never left the building —
 * and the admin UI ignored the list anyway, toasting "Customer has been
 * notified" unconditionally.
 *
 * An operator who trusts that skips the phone call. So every notification path
 * now reports per channel, and the UI says what really went out.
 *
 * Pure and dependency-free.
 */

export type NotificationChannel = 'email' | 'sms';

export type DeliveryFailureReason =
  /** No provider credentials configured for this channel. */
  | 'not_configured'
  /** The customer has no address/number on file. */
  | 'no_recipient'
  /** We have a value but it isn't usable (unparseable phone, malformed email). */
  | 'invalid_recipient'
  /** The provider was reachable and refused, or errored. */
  | 'provider_error'
  /** The caller deliberately didn't use this channel. */
  | 'not_requested';

export interface DeliveryFailure {
  channel: NotificationChannel;
  reason: DeliveryFailureReason;
  detail?: string;
}

export interface DeliveryOutcome {
  /** Channels the message actually went out on. */
  delivered: NotificationChannel[];
  /** Channels that were attempted or expected and didn't happen. */
  failed: DeliveryFailure[];
}

const REASON_TEXT: Record<DeliveryFailureReason, string> = {
  not_configured: 'not configured',
  no_recipient: 'no number on file',
  invalid_recipient: 'invalid number',
  provider_error: 'failed to send',
  not_requested: 'skipped',
};

/** Email has an address, not a number, so the recipient reasons need different
 * words. Everything else reads the same for both channels. */
const EMAIL_REASON_TEXT: Partial<Record<DeliveryFailureReason, string>> = {
  no_recipient: 'no address on file',
  invalid_recipient: 'invalid address',
};

const CHANNEL_TEXT: Record<NotificationChannel, string> = {
  email: 'Email',
  sms: 'SMS',
};

function reasonText(failure: DeliveryFailure): string {
  const override = failure.channel === 'email' ? EMAIL_REASON_TEXT[failure.reason] : undefined;
  return override ?? REASON_TEXT[failure.reason];
}

/**
 * One short line describing the outcome, for an admin toast.
 *
 *   "Email sent · SMS not configured"
 *   "Email sent"
 *   "Nothing sent — Email failed to send, SMS no number on file"
 *
 * Deliberately never says "notified" when nothing was delivered.
 */
export function describeDelivery(outcome: DeliveryOutcome): string {
  const sent = outcome.delivered.map((c) => `${CHANNEL_TEXT[c]} sent`);

  // 'not_requested' is a deliberate choice by the caller, not a problem worth
  // reporting to whoever clicked the button.
  const problems = outcome.failed
    .filter((f) => f.reason !== 'not_requested')
    .map((f) => `${CHANNEL_TEXT[f.channel]} ${reasonText(f)}`);

  if (sent.length === 0) {
    return problems.length > 0 ? `Nothing sent — ${problems.join(', ')}` : 'Nothing sent';
  }

  return [...sent, ...problems].join(' · ');
}

/** True when at least one channel actually delivered. */
export function anyDelivered(outcome: DeliveryOutcome): boolean {
  return outcome.delivered.length > 0;
}

/** Appends the real per-channel outcome to an action message, e.g.
 * "Order confirmed. Email sent · SMS not configured." */
export function withDeliveryNote(message: string, outcome: DeliveryOutcome): string {
  return `${message} ${describeDelivery(outcome)}.`;
}
