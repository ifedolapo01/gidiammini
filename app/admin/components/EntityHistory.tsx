/**
 * ADMIN layer — the "History" panel for one order, product or customer.
 *
 * The same query as the activity feed with the entity fixed, rendered through
 * the same list. Drop it into a detail view and it answers "what has happened
 * to this record" without any per-page wiring.
 */
'use client';

import ActivityList from '@/app/admin/activity/components/ActivityList';
import { useActivityFeed } from '@/app/admin/activity/hooks/useActivityFeed';
import { entityLabel } from '@/lib/commerce/audit-format';

interface EntityHistoryProps {
  entityType: string;
  /** Absent while a parent is still loading — the fetch waits rather than
   * asking for the history of `undefined`. */
  entityId?: string | null;
  /** Hide the heading where the surrounding tab already provides one. */
  showHeading?: boolean;
  pageSize?: number;
}

export default function EntityHistory({
  entityType,
  entityId,
  showHeading = true,
  pageSize = 20,
}: EntityHistoryProps) {
  const { entries, total, page, pageCount, loading, error, goToPage } = useActivityFeed({
    entity_type: entityType,
    entity_id: entityId ?? undefined,
    pageSize,
    enabled: Boolean(entityId),
  });

  return (
    <section className="bg-surface border border-border rounded-surface overflow-hidden">
      {showHeading && (
        <header className="px-3 sm:px-4 py-3 border-b border-divider">
          <h2 className="text-body-md font-bold text-text-primary">History</h2>
          <p className="text-caption-md text-text-secondary">
            Changes to this {entityLabel(entityType).toLowerCase()}, newest first.
          </p>
        </header>
      )}

      <ActivityList
        entries={entries}
        loading={loading}
        error={error}
        page={page}
        pageCount={pageCount}
        total={total}
        onPageChange={goToPage}
        showEntity={false}
        emptyMessage="No changes recorded for this record yet."
      />
    </section>
  );
}
