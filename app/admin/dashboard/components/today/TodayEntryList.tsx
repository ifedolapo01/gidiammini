/** ADMIN layer — the specific items behind one worklist count.
 *
 * What a rotating ticker could never do: the count says "4 receipts waiting",
 * and this says whose, for how much, and how long they have been waiting —
 * with a link straight to the screen where each is dealt with, and, where the
 * action needs no judgement, a button that does it here.
 */
'use client';

import Link from 'next/link';
import { ArrowRight, Truck } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { useMarkShipped } from '@/app/admin/hooks/useMarkShipped';
import { useWorklistTask } from '@/app/admin/hooks/useWorklistTask';
import type { WorklistTask } from '@/types/worklist';

interface TodayEntryListProps {
  task: WorklistTask;
  /** Where the whole list lives, for the "see all" link. */
  href: string;
  /** Refetch the counts above once an inline action changes something. */
  onChanged: () => void;
}

export function TodayEntryList({ task, href, onChanged }: TodayEntryListProps) {
  const { entries, loading, error, truncated, refresh } = useWorklistTask(task, true);

  const { markShipped, shippingId } = useMarkShipped(async () => {
    await refresh();
    onChanged();
  });

  if (loading && entries.length === 0) {
    return (
      <p className="flex items-center gap-2 px-3 py-3 text-body-sm text-text-secondary">
        <Spinner size="sm" className="text-primary" />
        Loading these items…
      </p>
    );
  }

  if (error) {
    return (
      <p role="alert" className="px-3 py-3 text-body-sm text-destructive">
        {error}{' '}
        <button type="button" onClick={refresh} className="font-medium underline">
          Try again
        </button>
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="px-3 py-3 text-body-sm text-text-secondary">
        Nothing left here — the count is on its way down.
      </p>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-divider">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:flex-nowrap">
            <Link
              href={entry.href}
              className="min-w-0 flex-1 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus"
            >
              <span className="block truncate text-body-sm font-medium text-text-primary">
                {entry.title}
              </span>
              <span className="block truncate text-caption-md text-text-secondary">
                {entry.subtitle}
                {entry.meta && <> · {entry.meta}</>}
              </span>
            </Link>

            {typeof entry.amount === 'number' && (
              <span className="shrink-0 text-body-sm font-semibold tabular-nums text-text-primary">
                {formatCurrency(entry.amount)}
              </span>
            )}

            {entry.action === 'ship' ? (
              <Button
                size="sm"
                variant="outline"
                loading={shippingId === entry.id}
                onClick={() => markShipped(entry.id, entry.subtitle)}
              >
                <Truck className="size-4" aria-hidden="true" />
                Shipped
              </Button>
            ) : (
              <Link
                href={entry.href}
                aria-label={`Open ${entry.title}`}
                className="grid size-11 shrink-0 place-items-center rounded-control text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
              >
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            )}
          </li>
        ))}
      </ul>

      {truncated && (
        <Link
          href={href}
          className="flex min-h-11 items-center gap-1.5 px-3 text-body-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
        >
          See all of them
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
