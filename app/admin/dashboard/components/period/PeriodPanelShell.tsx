/** ADMIN layer — shared shell for the period section's breakdown panels.
 *
 * Split out of RevenueBreakdownPanels.tsx once every panel needed the same
 * three things: the card frame with a tooltip on its header, the proportion
 * bar, and a drill-through href built from the dashboard's window. Keeping
 * them here means the three panel files stay about "what a row shows," not
 * about how the frame around it works.
 */
'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Tooltip } from '@/components/ui';
import type { DateRange } from '@/lib/commerce/date-range';

/** The cards above these panels are computed over this window; every row a
 *  panel links out of must carry the same one, or the list it opens would
 *  disagree with the numbers that pointed at it. */
export type PeriodWindow = Pick<DateRange, 'from' | 'to'>;

/** `/admin/orders?from=&to=&...extra`, matching the cards' own drill-through. */
export function ordersHrefFor(window: PeriodWindow, extra: Record<string, string>): string {
  const params = new URLSearchParams({ from: window.from, to: window.to, ...extra });
  return `/admin/orders?${params.toString()}`;
}

export function Panel({
  title,
  description,
  empty,
  rows,
  children,
}: {
  title: string;
  description: string;
  empty: string;
  rows: number;
  children: ReactNode;
}) {
  return (
    <section className="rounded-surface border border-border bg-surface shadow-elevation-1">
      <div className="border-b border-border-light p-4 sm:p-5">
        <div className="flex items-center gap-1">
          <h3 className="text-body-lg font-bold text-text-primary">{title}</h3>
          <Tooltip content={description} />
        </div>
        <p className="mt-0.5 text-caption-md text-text-secondary">{description}</p>
      </div>
      {rows === 0 ? (
        <p className="p-6 text-center text-body-sm text-text-secondary">{empty}</p>
      ) : (
        <ul className="divide-y divide-border-light">{children}</ul>
      )}
    </section>
  );
}

/** The proportion bar shared by every panel. */
export function ShareBar({ share, tone }: { share: number; tone: string }) {
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background-tertiary">
      <div className={tone} style={{ width: `${Math.max(1, Math.round(share * 100))}%`, height: '100%' }} />
    </div>
  );
}

/** Classes shared by every clickable row — a block-level Link filling the
 *  <li>, since the row (not a small link inside it) is the click target. */
export const ROW_LINK_CLASSNAME =
  'block p-4 transition-colors hover:bg-surface-hover focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus';

/** The "Review zone fees" footer both zone panels share. */
export function ReviewZoneFeesLink() {
  return (
    <li className="p-3 text-center">
      <Link
        href="/admin/shipping"
        className="text-caption-md font-medium text-primary hover:text-primary-hover"
      >
        Review zone fees
      </Link>
    </li>
  );
}
