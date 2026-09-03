/** ADMIN layer — the status timeline on an order, from order_status_history. */
import { formatDate } from '@/lib/commerce/format-date';
import { getStatusIcon, formatOrderStatus } from '@/lib/commerce/order-status';
import { asOrderStatus } from '@/lib/commerce/db-narrowing';

interface StatusHistoryEntry {
  id: string;
  /** Text in the database, narrowed on read — see lib/commerce/db-narrowing.ts. */
  status: string;
  changed_at: string;
}

/**
 * What the order passed through, oldest first.
 *
 * Complements the Activity panel rather than duplicating it: this is the
 * order's own state timeline, while Activity says who made each change and
 * why. Extracted from OrderDetailsModal to keep that file under the size limit
 * when Activity was added beside it.
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
          <li
            key={entry.id}
            className="flex items-center justify-between gap-3 p-3 bg-background-secondary rounded-surface"
          >
            <span className="flex items-center gap-2 text-body-sm font-medium text-text-primary">
              {getStatusIcon(asOrderStatus(entry.status))}
              {formatOrderStatus(entry.status)}
            </span>
            <span className="text-body-sm text-text-secondary">{formatDate(entry.changed_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
