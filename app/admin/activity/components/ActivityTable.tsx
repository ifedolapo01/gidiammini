/**
 * ADMIN layer — the audit trail as a table, for screens wide enough for one.
 *
 * Deliberately thin: when, what kind of action, on what, and a one-line summary
 * of the change. Everything else — the full before/after breakdown, the reason
 * given, the IP — is behind Review, in ActivityDetailModal.
 *
 * An earlier version put "What changed / Was / Changed to" in the table itself.
 * It read badly: a product save whose only recorded diff was `updated_at`
 * announced "Updated At 22:40 → 22:47" as though that were the news, next to a
 * When column already saying it in a different timezone. Bookkeeping timestamps
 * are now filtered out of the diff entirely, and the detail moved behind a
 * button so the table stays scannable.
 *
 * Paired with ActivityEntry, which renders the same data as a stacked card on
 * narrow screens.
 */
'use client';

import { Badge, Button } from '@/components/ui';
import { formatDate } from '@/lib/commerce/format-date';
import {
  actionLabel,
  actionTone,
  actorLabel,
  changeSummary,
  entityLabel,
  entityShortId,
  needsFailureBadge,
  type AuditLogEntry,
} from '@/lib/commerce/audit-format';

const TH = 'px-4 py-3 text-left text-caption-md font-medium text-text-secondary uppercase tracking-wider whitespace-nowrap';
const TD = 'px-4 py-3 align-middle';

interface ActivityTableProps {
  entries: AuditLogEntry[];
  loading: boolean;
  showEntity?: boolean;
  onReview: (entry: AuditLogEntry) => void;
}

export default function ActivityTable({ entries, loading, showEntity = true, onReview }: ActivityTableProps) {
  return (
    // overflow-x-auto so a long value scrolls the table rather than the page.
    <div className="hidden md:block overflow-x-auto">
      <table className="min-w-full divide-y divide-divider">
        <caption className="sr-only">
          Admin activity, newest first. Review opens the full before-and-after detail for an entry.
        </caption>
        <thead className="bg-background-secondary">
          <tr>
            <th scope="col" className={TH}>When</th>
            <th scope="col" className={TH}>Action</th>
            {showEntity && <th scope="col" className={TH}>Item</th>}
            <th scope="col" className={TH}>Change</th>
            <th scope="col" className={TH}>By</th>
            <th scope="col" className={`${TH} text-right`}>
              <span className="sr-only">Review</span>
            </th>
          </tr>
        </thead>
        <tbody aria-busy={loading} className="bg-surface divide-y divide-divider">
          {entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-surface-hover">
              <td className={`${TD} whitespace-nowrap text-caption-md text-text-secondary`}>
                {formatDate(entry.created_at)}
              </td>

              <td className={`${TD} whitespace-nowrap`}>
                <div className="flex items-center gap-1.5">
                  <Badge
                    tone={needsFailureBadge(entry) ? 'destructive' : actionTone(entry.action)}
                    variant="subtle"
                  >
                    {actionLabel(entry.action)}
                  </Badge>
                  {/* Only where the action's own label does not already say it
                      failed — "Sign-in failed" needs no "Failed" beside it. */}
                  {needsFailureBadge(entry) && (
                    <Badge tone="destructive" variant="outline">
                      Failed
                    </Badge>
                  )}
                </div>
              </td>

              {showEntity && (
                <td className={`${TD} whitespace-nowrap`}>
                  <span className="text-body-sm text-text-primary">{entityLabel(entry.entity_type)}</span>
                  <span className="block font-mono text-caption-md text-text-secondary">
                    {entityShortId(entry)}
                  </span>
                </td>
              )}

              <td className={`${TD} text-caption-md text-text-secondary max-w-xs truncate`}>
                {changeSummary(entry)}
              </td>

              <td className={`${TD} whitespace-nowrap text-caption-md text-text-primary`}>
                {actorLabel(entry)}
              </td>

              <td className={`${TD} text-right`}>
                <Button variant="outline" size="sm" onClick={() => onReview(entry)}>
                  Review
                  <span className="sr-only">
                    {' '}
                    {actionLabel(entry.action)} on {entityLabel(entry.entity_type)}{' '}
                    {formatDate(entry.created_at)}
                  </span>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
