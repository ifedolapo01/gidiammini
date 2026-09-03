/**
 * ADMIN layer — one audit entry as a card, for narrow screens.
 *
 * The narrow counterpart to ActivityTable, and kept just as thin: the full
 * before/after breakdown is behind Review, in ActivityDetailModal.
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

interface ActivityEntryProps {
  entry: AuditLogEntry;
  /** Hidden on a per-entity History tab, where every row is the same entity. */
  showEntity?: boolean;
  onReview: (entry: AuditLogEntry) => void;
}

export default function ActivityEntry({ entry, showEntity = true, onReview }: ActivityEntryProps) {
  return (
    <li className="border-b border-divider last:border-0 py-3 px-3 sm:px-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          tone={needsFailureBadge(entry) ? 'destructive' : actionTone(entry.action)}
          variant="subtle"
        >
          {actionLabel(entry.action)}
        </Badge>

        {needsFailureBadge(entry) && (
          <Badge tone="destructive" variant="outline">
            Failed
          </Badge>
        )}

        {showEntity && (
          <span className="text-body-sm text-text-primary font-medium">
            {entityLabel(entry.entity_type)}{' '}
            <span className="font-mono text-caption-md text-text-secondary">
              {entityShortId(entry)}
            </span>
          </span>
        )}

        <span className="ml-auto text-caption-md text-text-muted whitespace-nowrap">
          {formatDate(entry.created_at)}
        </span>
      </div>

      <p className="mt-1 text-caption-md text-text-secondary">
        by <span className="text-text-primary">{actorLabel(entry)}</span>
      </p>

      <p className="mt-1 text-caption-md text-text-secondary break-words">{changeSummary(entry)}</p>

      <Button variant="outline" size="sm" className="mt-2" onClick={() => onReview(entry)}>
        Review
        <span className="sr-only">
          {' '}
          {actionLabel(entry.action)} on {entityLabel(entry.entity_type)} {formatDate(entry.created_at)}
        </span>
      </Button>
    </li>
  );
}
