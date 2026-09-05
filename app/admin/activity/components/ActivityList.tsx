/**
 * ADMIN layer — the shared body of both audit surfaces.
 *
 * The activity feed and the per-entity History tab differ only in which
 * filters are fixed, so they render through this rather than duplicating the
 * list, the empty state and the paging.
 */
'use client';
import { ActivityListSkeleton } from './ActivityListSkeleton';

import { useState } from 'react';
import TablePagination from '@/app/admin/components/TablePagination';
import type { AuditLogEntry } from '@/lib/commerce/audit-format';
import ActivityEntry from './ActivityEntry';
import ActivityTable from './ActivityTable';
import ActivityDetailModal from './ActivityDetailModal';

interface ActivityListProps {
  entries: AuditLogEntry[];
  loading: boolean;
  error: string;
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  showEntity?: boolean;
  emptyMessage?: string;
}

export default function ActivityList({
  entries,
  loading,
  error,
  page,
  pageCount,
  total,
  onPageChange,
  showEntity = true,
  emptyMessage = 'Nothing recorded yet.',
}: ActivityListProps) {
  /** The entry whose full detail is open, if any. Held here so the table and
   * the card list share one modal rather than each rendering their own. */
  const [reviewing, setReviewing] = useState<AuditLogEntry | null>(null);
  if (loading && entries.length === 0) {
    return <ActivityListSkeleton />;
  }

  if (error) {
    return (
      <div
        role="alert"
        className="m-3 p-3 rounded-control bg-destructive-background border border-destructive-border text-body-sm text-destructive"
      >
        {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return <p className="py-10 text-center text-body-sm text-text-secondary">{emptyMessage}</p>;
  }

  return (
    <>
      {/* A table where there is room for six columns, stacked cards where
          there is not. Same data and same formatter either way — only the
          presentation differs, because a six-column diff does not survive a
          phone and a horizontally scrolling table is worse than a card. */}
      <ActivityTable
        entries={entries}
        loading={loading}
        showEntity={showEntity}
        onReview={setReviewing}
      />

      {/* aria-busy so a screen reader is told the list is being replaced,
          rather than silently reading stale rows during a page change. */}
      <ul aria-busy={loading} className="md:hidden divide-y divide-divider">
        {entries.map((entry) => (
          <ActivityEntry
            key={entry.id}
            entry={entry}
            showEntity={showEntity}
            onReview={setReviewing}
          />
        ))}
      </ul>

      <ActivityDetailModal entry={reviewing} onClose={() => setReviewing(null)} />

      {/* The feed's pages are 0-indexed internally; TablePagination speaks the
          1-indexed `?page=` every admin list endpoint takes. */}
      <TablePagination
        page={page + 1}
        pageCount={pageCount}
        total={total}
        loading={loading}
        onPageChange={(next) => onPageChange(next - 1)}
        itemNoun="entries"
        label="Activity pages"
      />
    </>
  );
}
