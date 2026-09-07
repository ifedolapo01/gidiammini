/**
 * What a Resend delivery event means for a notification row and, for a hard
 * bounce, for the subscriber it happened to.
 *
 * Pure and synchronous on purpose, same as classifyResendError in
 * lib/email-resend.ts: the interesting decision — which event types matter,
 * what status and detail each becomes — should be testable without a running
 * server or a real webhook signature. The route (app/api/webhooks/resend)
 * does the verifying and the writing; this does the deciding.
 */
import type { WebhookEventPayload } from 'resend';
import type { NotificationStatus } from './log';

export interface NotificationUpdate {
  providerMessageId: string;
  status: NotificationStatus;
  detail?: string;
}

/**
 * The event types this shop acts on, and how. Every other type — sent,
 * scheduled, opened, clicked, delivery_delayed, received, suppressed, and
 * every contact- or domain-related event a shared webhook endpoint would also
 * receive — is understood and ignored: 'sent' is already recorded at send
 * time by lib/notifications/log.ts, and the rest describe engagement or
 * account events this shop does not track.
 */
export function notificationUpdateFor(event: WebhookEventPayload): NotificationUpdate | null {
  switch (event.type) {
    case 'email.delivered':
      return { providerMessageId: event.data.email_id, status: 'delivered' };

    case 'email.bounced':
      return {
        providerMessageId: event.data.email_id,
        status: 'bounced',
        detail: event.data.bounce.message,
      };

    case 'email.complained':
      return { providerMessageId: event.data.email_id, status: 'complained' };

    case 'email.failed':
      return {
        providerMessageId: event.data.email_id,
        status: 'failed',
        detail: event.data.failed.reason,
      };

    default:
      return null;
  }
}

/**
 * Whether this event means an address is dead and should stop receiving
 * marketing mail, and who it happened to.
 *
 * Only a hard bounce qualifies. A complaint means "I don't want this", not
 * "this address doesn't work" — the address is still live, and
 * subscribers.unsubscribe_source has no value for that distinction (only
 * 'link', 'admin', 'bounce' — see migration 20260906140000), so recording a
 * complaint as a bounce would be a false entry in that audit trail rather than
 * an honest one.
 */
export function bouncedRecipients(event: WebhookEventPayload): string[] {
  return event.type === 'email.bounced' ? event.data.to : [];
}
