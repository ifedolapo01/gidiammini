/** ADMIN layer — where the period's money came from. Presentation only.
 *
 * Bars rather than a pie: these are comparisons, and a reader spots a long bar
 * beside a short one faster than they judge two wedges. A pie would also hide
 * the numbers, and the numbers are the point.
 *
 * The zone panel carries a second figure the category one does not — what was
 * charged for delivery. Revenue alone cannot tell you which routes are worth a
 * courier negotiation; revenue against delivery cost can, and this shop is one
 * of very few that models zones well enough to say.
 */
'use client';

import Link from 'next/link';
import { formatCurrency } from '@/lib/commerce/pricing';
import type { CategoryRevenue, ZoneRevenue } from '@/lib/commerce/revenue-breakdown';

function Panel({
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
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-surface border border-border bg-surface shadow-elevation-1">
      <div className="border-b border-border-light p-4 sm:p-5">
        <h3 className="text-body-lg font-bold text-text-primary">{title}</h3>
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

/** The proportion bar shared by both panels. */
function ShareBar({ share, tone }: { share: number; tone: string }) {
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background-tertiary">
      <div className={tone} style={{ width: `${Math.max(1, Math.round(share * 100))}%`, height: '100%' }} />
    </div>
  );
}

export function RevenueByCategoryPanel({ categories }: { categories: CategoryRevenue[] }) {
  return (
    <Panel
      title="Revenue by category"
      // Said plainly, because it is why this total need not match the zone
      // panel's: an order with a dress and a babygrow is split across two
      // categories rather than landing arbitrarily in one.
      description="Line values on paid orders, split across the categories in each basket."
      empty="No paid orders in this period yet."
      rows={categories.length}
    >
      {categories.slice(0, 8).map((row) => (
        <li key={row.category} className="p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate font-medium capitalize text-text-primary">{row.category}</span>
            <span className="shrink-0 text-body-sm font-medium text-text-primary">
              {formatCurrency(row.revenue)}
            </span>
          </div>
          <ShareBar share={row.share} tone="bg-primary" />
          <p className="mt-1 text-caption-md text-text-secondary">
            {Math.round(row.share * 100)}% of sales · {row.units} unit{row.units === 1 ? '' : 's'}
          </p>
        </li>
      ))}
    </Panel>
  );
}

export function RevenueByZonePanel({ zones }: { zones: ZoneRevenue[] }) {
  return (
    <Panel
      title="Revenue by delivery zone"
      description="Money kept per zone, against what was charged to deliver there."
      empty="No orders in this period yet."
      rows={zones.length}
    >
      {zones.slice(0, 8).map((row) => (
        <li key={row.zoneId ?? row.label} className="p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate font-medium text-text-primary">{row.label}</span>
            <span className="shrink-0 text-body-sm font-medium text-text-primary">
              {formatCurrency(row.revenue)}
            </span>
          </div>
          <ShareBar share={row.share} tone="bg-accent" />
          <p className="mt-1 text-caption-md text-text-secondary">
            {row.orders} order{row.orders === 1 ? '' : 's'} · {formatCurrency(row.averageOrderValue)}{' '}
            average
            {row.shippingCharged > 0 && (
              <> · {formatCurrency(row.shippingCharged)} delivery charged</>
            )}
          </p>
        </li>
      ))}

      <li className="p-3 text-center">
        <Link
          href="/admin/shipping"
          className="text-caption-md font-medium text-primary hover:text-primary-hover"
        >
          Review zone fees
        </Link>
      </li>
    </Panel>
  );
}
