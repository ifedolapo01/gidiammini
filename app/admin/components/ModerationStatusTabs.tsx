/**
 * ADMIN layer — the status filter over a moderation queue.
 *
 * Shared by the review and question queues. Tabs rather than a select, because
 * the pending count is the number these pages exist for — the gap between
 * something being submitted and something being visible — and it should be
 * readable without opening anything.
 *
 * The labels are passed in: "Awaiting review" and "Needs an answer" are the
 * same status meaning two different jobs, and a component that guessed which
 * would be wrong on one of the two pages.
 *
 * Rendered as a tablist so arrow keys work and the selected tab is announced
 * as selected rather than as a pressed button.
 */
'use client';

import { cn } from '@/lib/utils';
import type { ModerationCounts, ModerationFilter } from '../hooks/useModerationQueue';

const ORDER: ModerationFilter[] = ['pending', 'published', 'rejected', 'all'];

interface ModerationStatusTabsProps {
  value: ModerationFilter;
  onChange: (value: ModerationFilter) => void;
  counts: ModerationCounts;
  /** The count for the selected tab, from the query that built the list — so a
   *  filter and its tally are never a request apart. */
  total: number;
  labels: Record<ModerationFilter, string>;
}

export default function ModerationStatusTabs({
  value,
  onChange,
  counts,
  total,
  labels,
}: ModerationStatusTabsProps) {
  const countFor = (tab: ModerationFilter): number =>
    tab === 'all' ? counts.pending + counts.published + counts.rejected : counts[tab];

  return (
    <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-2">
      {ORDER.map((tab) => {
        const selected = tab === value;

        return (
          <button
            key={tab}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(tab)}
            className={cn(
              'inline-flex h-11 items-center gap-2 rounded-control border px-3 text-body-sm font-medium',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-surface text-text-secondary hover:bg-surface-hover'
            )}
          >
            {labels[tab]}
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-caption-sm',
                selected ? 'bg-primary-foreground/20' : 'bg-background-tertiary text-text-primary'
              )}
            >
              {selected && tab !== 'all' ? total : countFor(tab)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
