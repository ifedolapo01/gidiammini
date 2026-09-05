/** ADMIN layer — the status timeline on an order, from order_status_history. */
import { formatDate } from '@/lib/commerce/format-date';
import { getStatusIcon, formatOrderStatus } from '@/lib/commerce/order-status';
import { cancellationLabel } from '@/lib/commerce/cancellation-reasons';
import { asOrderStatus } from '@/lib/commerce/db-narrowing';

interface StatusHistoryEntry {
  id: string;
  /** Text in the database, narrowed on read — see lib/commerce/db-narrowing.ts. */
  status: string;
  changed_at: string;
  /** Who moved it. Null for the transitions nothing human made: the order's
   * own creation, an expired reservation, a payment confirmation. */
  actor_email?: string | null;
  /** Why, where the admin gave one. */
  reason?: string | null;
  /** The same answer from the fixed vocabulary. Shown as a chip rather than
   * folded into the free text, because it is the part that is comparable
   * across orders — the eye should be able to run down a list of cancellations
   * and see the pattern. */
  reason_code?: string | null;
}

/**
 * What the order passed through, oldest first, and who moved it.
 *
 * Complements the Activity panel rather than duplicating it: this is the
 * order's own state timeline — including the transitions no admin caused —
 * while Activity is every change anybody made to anything on this order.
 *
 * The actor line is the whole reason this table gained columns. "Cancelled ·
 * 14:32" and "Cancelled by ada@shop.com · customer asked to cancel" are the
 * same row; only one of them ends the conversation that follows.
 */
export default function OrderStatusHistory({ entries }: { entries: StatusHistoryEntry[] }) {
  if (entries.length === 0) return null;

  const ordered = [...entries].sort(
    (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
  );

  return (
    <div className="mb-6">
      <h3 className="font-semibold text-text-primary mb-3">Status History</h3>
      <ul className="space-y-2">
        {ordered.map((entry) => (
          <li key={entry.id} className="rounded-surface bg-background-secondary p-3">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="flex items-center gap-2 text-body-sm font-medium text-text-primary">
                {getStatusIcon(asOrderStatus(entry.status))}
                {formatOrderStatus(entry.status)}
              </span>
              <span className="text-body-sm text-text-secondary">{formatDate(entry.changed_at)}</span>
            </div>

            <p className="mt-1 text-caption-md text-text-secondary">
              {/* 'System' rather than a blank: an unattributed transition was
                  made by the shop itself, not by somebody unidentified. */}
              by <span className="text-text-primary">{entry.actor_email || 'System'}</span>
            </p>

            {entry.reason_code && (
              <p className="mt-1.5">
                <span className="inline-flex rounded-control bg-surface px-2 py-0.5 text-caption-md font-medium text-text-primary">
                  {cancellationLabel(entry.reason_code)}
                </span>
              </p>
            )}

            {entry.reason && (
              <p className="mt-1 break-words text-caption-md text-text-secondary">
                &ldquo;{entry.reason}&rdquo;
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
