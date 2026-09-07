/** ADMIN layer — revenue split across the categories in the period's baskets.
 *
 * Rows link into the orders list filtered to that category. Category lives on
 * the product, not the order, so the filter is resolved server-side via
 * order_items -> products.category (see admin-orders-query.ts) rather than
 * being a column the orders table already has, the way zone is.
 */
'use client';

import Link from 'next/link';
import { formatCurrency } from '@/lib/commerce/pricing';
import type { CategoryRevenue } from '@/lib/commerce/revenue-breakdown';
import { Panel, ShareBar, ordersHrefFor, ROW_LINK_CLASSNAME, type PeriodWindow } from './PeriodPanelShell';

export function RevenueByCategoryPanel({
  categories,
  window,
}: {
  categories: CategoryRevenue[];
  window: PeriodWindow;
}) {
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
        <li key={row.category}>
          <Link href={ordersHrefFor(window, { category: row.category })} className={ROW_LINK_CLASSNAME}>
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
          </Link>
        </li>
      ))}
    </Panel>
  );
}
