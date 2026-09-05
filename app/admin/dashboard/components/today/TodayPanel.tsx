/** ADMIN layer — the whole morning's work, on one screen, in priority order.
 *
 * WHAT THIS REPLACES
 *
 * The same alerts used to be a scrolling ticker across the top of every admin
 * page: one at a time, four seconds each, in rotation. It was carefully built —
 * it paused on hover, it respected prefers-reduced-motion, each item could be
 * dismissed — and it still could not answer the only question an operator has
 * at 9am: what is waiting for me? The count you needed was always the one
 * currently scrolled off, the work behind a count was spread across four other
 * pages, and nothing could be acted on from where it was announced.
 *
 * WHAT CHANGED, AND WHAT DID NOT
 *
 * Nothing about where the numbers come from. The same six sources, the same
 * tones, the same priority field — see app/admin/lib/alert-sources.ts. What is
 * different is the information architecture: everything at once, grouped by
 * concern, counted, sorted by priority, and every row expandable into the
 * specific orders behind it with the action right there.
 *
 * The ticker still exists, as a compact indicator on every other page. This
 * panel is why the dashboard does not need it.
 */
'use client';

import { CheckCircle2, ListChecks, RefreshCw } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { useAdminAlerts } from '@/app/admin/hooks/useAdminAlerts';
import { countWorkItems, groupAlerts } from '@/app/admin/lib/alert-groups';
import { TodayGroup } from './TodayGroup';

export function TodayPanel() {
  const { alerts, loading, refetch } = useAdminAlerts();

  const groups = groupAlerts(alerts);
  const work = countWorkItems(alerts);

  return (
    <section aria-labelledby="today-heading" className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <h2 id="today-heading" className="text-h5 font-bold text-text-primary">
            Today
          </h2>
          {/* aria-live, so the count reaching zero is announced rather than
              only looking different. */}
          <span className="text-body-sm text-text-secondary" aria-live="polite">
            {loading && alerts.length === 0
              ? 'checking…'
              : work === 0
                ? 'nothing waiting'
                : `${work} thing${work === 1 ? '' : 's'} waiting`}
          </span>
        </div>

        <button
          type="button"
          onClick={refetch}
          className="flex min-h-11 items-center gap-1.5 rounded-control px-2 text-body-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus"
        >
          {loading ? (
            <Spinner size="sm" className="text-primary" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
          Refresh
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-surface border border-success-border bg-success-background p-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 size-8 text-success" aria-hidden="true" />
          <p className="text-body-sm font-semibold text-text-primary">
            {loading ? 'Checking the shop…' : 'Nothing needs you right now'}
          </p>
          <p className="mt-1 text-caption-md text-text-secondary">
            Receipts, overdue orders and unanswered questions appear here as they arrive.
          </p>
        </div>
      ) : (
        // Two columns from lg. The groups are independent, so a tall expanded
        // one does not push the others down the page.
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
          {groups.map((group) => (
            <TodayGroup key={group.key} group={group} onChanged={refetch} />
          ))}
        </div>
      )}
    </section>
  );
}
