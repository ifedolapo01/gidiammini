/** ADMIN layer — what this customer was sent, and the button to send it again.
 *
 * The panel that answers "I never got it". Before this the shop had nothing to
 * answer with: every send returned a result that was read for a toast and then
 * dropped.
 *
 * IT SAYS WHAT IT KNOWS AND NO MORE
 *
 * The transport is SMTP, which can report that a mail server accepted a
 * message and — at handshake — that it refused a recipient. It cannot report
 * arrival. So a successful row reads "Sent" with the Message-ID behind it, and
 * never "Delivered". Overstating that here would be worse than the silence it
 * replaces: an operator who reads "Delivered" stops looking, and the customer
 * is still right.
 */
'use client';

import { Mail, MessageSquare, RotateCw } from 'lucide-react';
import { Badge, Button, Spinner, type BadgeTone } from '@/components/ui';
import { formatDate } from '@/lib/commerce/format-date';
import { isResendable, kindLabel } from '@/lib/notifications/kinds';
import type { OrderNotification } from '../hooks/useOrderNotifications';

interface TimelineProps {
  notifications: OrderNotification[];
  loading: boolean;
  unavailable: boolean;
  resendingId: string | null;
  onResend: (id: string) => void;
}

const STATUS_TONE: Record<OrderNotification['status'], BadgeTone> = {
  sent: 'success',
  delivered: 'success',
  failed: 'destructive',
  bounced: 'destructive',
  complained: 'warning',
};

const STATUS_LABEL: Record<OrderNotification['status'], string> = {
  // Not "Delivered". See the header.
  sent: 'Accepted by mail server',
  delivered: 'Delivered',
  failed: 'Not sent',
  bounced: 'Refused',
  complained: 'Marked as spam',
};

/** The reason codes from lib/notifications/delivery.ts, in an operator's words. */
const REASON_TEXT: Record<string, string> = {
  not_configured: 'email is not configured on this deployment',
  no_recipient: 'no address on file',
  invalid_recipient: 'the address is not usable',
  provider_error: 'the mail server refused it',
  not_requested: 'not requested',
};

function Row({
  notification,
  resending,
  onResend,
}: {
  notification: OrderNotification;
  resending: boolean;
  onResend: () => void;
}) {
  const Icon = notification.channel === 'sms' ? MessageSquare : Mail;
  const failed = notification.status === 'failed' || notification.status === 'bounced';

  return (
    <li className="flex flex-wrap items-start gap-3 py-3">
      <Icon size={16} className="mt-1 shrink-0 text-text-secondary" aria-hidden />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-text-primary">{kindLabel(notification.kind)}</span>
          <Badge tone={STATUS_TONE[notification.status]}>{STATUS_LABEL[notification.status]}</Badge>
          {notification.resend_of && <Badge tone="neutral">Resent</Badge>}
        </div>

        <p className="text-body-sm text-text-secondary mt-0.5 break-words">
          To {notification.recipient} · {formatDate(notification.created_at)}
        </p>

        {notification.subject && (
          <p className="text-caption-md text-text-secondary mt-0.5 break-words">
            “{notification.subject}”
          </p>
        )}

        {failed && (
          <p className="text-caption-md text-destructive mt-1 break-words">
            {REASON_TEXT[notification.failure_reason ?? ''] ?? 'It did not go out'}
            {notification.failure_detail ? ` — ${notification.failure_detail}` : ''}
          </p>
        )}

        {/* The handle a mail server's own logs are searched by, which is what
            an escalation past this screen needs. */}
        {notification.provider_message_id && (
          <p className="text-caption-md text-text-muted mt-1 font-mono break-all">
            {notification.provider_message_id}
          </p>
        )}
      </div>

      {notification.channel === 'email' && isResendable(notification.kind) && (
        <Button variant="secondary" size="sm" onClick={onResend} loading={resending}>
          <RotateCw size={14} aria-hidden />
          Send again
        </Button>
      )}
    </li>
  );
}

export default function OrderNotificationTimeline({
  notifications,
  loading,
  unavailable,
  resendingId,
  onResend,
}: TimelineProps) {
  return (
    <section className="mt-6">
      <h3 className="text-body-md font-bold text-text-primary mb-1">Messages sent</h3>
      <p className="text-caption-md text-text-secondary mb-3">
        “Accepted by mail server” means it left here. This transport cannot confirm it reached an
        inbox.
      </p>

      {loading ? (
        <p className="flex items-center gap-2 py-4 text-body-sm text-text-secondary">
          <Spinner size="sm" />
          Loading…
        </p>
      ) : unavailable ? (
        <p className="rounded-control border border-warning-border bg-warning-background p-3 text-body-sm text-warning">
          The message log is not available on this deployment yet. Messages are still being sent —
          apply migration 20260906140000 to start recording them.
        </p>
      ) : notifications.length === 0 ? (
        <p className="py-4 text-body-sm text-text-secondary">
          No record of a message for this order. Anything sent before the log was added will not
          appear here.
        </p>
      ) : (
        <ul className="divide-y divide-border-light">
          {notifications.map((notification) => (
            <Row
              key={notification.id}
              notification={notification}
              resending={resendingId === notification.id}
              onResend={() => onResend(notification.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
