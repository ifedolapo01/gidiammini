/** ADMIN layer — one concern's worth of the worklist.
 *
 * A heading, a total, and the rows. The total is the sum of its rows rather
 * than the number of rows: "Money to confirm · 7" means seven receipts, which
 * is what the morning actually costs, not two kinds of problem.
 */
'use client';

import type { AlertGroupBucket } from '@/app/admin/lib/alert-groups';
import { TodayTaskRow } from './TodayTaskRow';

interface TodayGroupProps {
  group: AlertGroupBucket;
  onChanged: () => void;
}

export function TodayGroup({ group, onChanged }: TodayGroupProps) {
  return (
    <section className="overflow-hidden rounded-surface border border-border bg-surface">
      <header className="flex items-baseline justify-between gap-3 border-b border-divider px-3 py-2.5">
        <div className="min-w-0">
          <h3 className="text-body-sm font-semibold text-text-primary">{group.label}</h3>
          <p className="truncate text-caption-md text-text-secondary">{group.hint}</p>
        </div>

        {/* Ambient groups get no total — there is nothing to count down. */}
        {!group.ambient && (
          <span className="shrink-0 text-h5 font-bold tabular-nums text-text-primary">
            {group.total}
          </span>
        )}
      </header>

      <ul className="divide-y divide-divider">
        {group.items.map((alert) => (
          <TodayTaskRow key={alert.id} alert={alert} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  );
}
