// lib/email-result.ts - the one result shape every email transport returns.
//
// A leaf module on purpose. Both transports (lib/email-resend.ts,
// lib/email-smtp.ts) and the facade (lib/email.ts) need this type, and putting
// it in any of them would make the other two import a transport to get a type.
import type { DeliveryFailureReason } from './notifications/delivery';

export type EmailSendResult =
  | {
      success: true;
      messageId?: string;
      /**
       * Recipients the provider refused synchronously, before the message was
       * queued.
       *
       * Only the SMTP transport ever populates this: a hard rejection during
       * the SMTP conversation is the one bounce it can see, and it sees it
       * immediately. Everything afterwards — a full mailbox, a deferral that
       * gives up at 3am, a spam complaint — is invisible to SMTP.
       *
       * Resend always reports this as empty, and that is not a gap: it accepts
       * the message and reports what happened next over a webhook, which is
       * what `notification_log.status` already has 'delivered', 'bounced' and
       * 'complained' for (see lib/notifications/log.ts, migration
       * 20260906140000). Nothing consumes that webhook yet, so a Resend bounce
       * currently shows as 'sent' until one does.
       *
       * `success` stays true when some recipients were accepted and others
       * refused, which is what actually happened. The caller decides whether a
       * partial send counts.
       */
      rejected?: string[];
    }
  | { success: false; reason: DeliveryFailureReason; detail: string };
