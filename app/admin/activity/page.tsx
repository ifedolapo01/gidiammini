/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/activity/page.tsx — the filterable activity feed over audit_log.
'use client';

import { useState } from 'react';
import ActivityFilters from './components/ActivityFilters';
import ActivityList from './components/ActivityList';
import { useActivityFeed, type ActivityFilters as Filters } from './hooks/useActivityFeed';

export default function ActivityPage() {
  const [filters, setFilters] = useState<Filters>({});
  const { entries, total, page, pageCount, loading, error, goToPage } = useActivityFeed(filters);

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <header>
        <h1 className="text-body-lg sm:text-h5 md:text-h4 font-bold text-text-primary">Activity</h1>
        <p className="mt-1 text-caption-md sm:text-body-sm text-text-secondary">
          Every change made through the admin: who, what, and when. Entries cannot be edited.
        </p>
      </header>

      <ActivityFilters filters={filters} onChange={setFilters} />

      <div className="bg-surface border border-border rounded-surface overflow-hidden">
        <ActivityList
          entries={entries}
          loading={loading}
          error={error}
          page={page}
          pageCount={pageCount}
          total={total}
          onPageChange={goToPage}
          emptyMessage={
            Object.values(filters).some(Boolean)
              ? 'No activity matches these filters.'
              : 'No activity recorded yet. Changes made from here on will appear.'
          }
        />
      </div>
    </div>
  );
}
