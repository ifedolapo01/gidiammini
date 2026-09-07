/** ADMIN layer — money kept per delivery zone, against what delivery cost.
 *
 * A row links into the orders list filtered to that zone via
 * orders.shipping_zone_id. When a zone has since been deleted, the row falls
 * back to the state it shipped to and is left unlinked rather than filtered
 * on a zone id that no longer resolves to anything — a state isn't a query
 * param admin-orders-query.ts supports, and inventing one for a handful of
 * orphaned rows isn't worth the surface area.
 */
'use client';

import Link from 'next/link';
import { formatCurrency } from '@/lib/commerce/pricing';
import type { ZoneRevenue } from '@/lib/commerce/revenue-breakdown';
import {
  Panel,
  ShareBar,
  ordersHrefFor,
  ReviewZoneFeesLink,
  ROW_LINK_CLASSNAME,
  type PeriodWindow,
} from './PeriodPanelShell';

function ZoneRow({ row, window }: { row: ZoneRevenue; window: PeriodWindow }) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate font-medium text-text-primary">{row.label}</span>
        <span className="shrink-0 text-body-sm font-medium text-text-primary">
          {formatCurrency(row.revenue)}
        </span>
      </div>
      <ShareBar share={row.share} tone="bg-accent" />
      <p className="mt-1 text-caption-md text-text-secondary">
        {row.orders} order{row.orders === 1 ? '' : 's'} · {formatCurrency(row.averageOrderValue)} average
        {row.shippingCharged > 0 && <> · {formatCurrency(row.shippingCharged)} delivery charged</>}
      </p>
    </>
  );

  if (!row.zoneId) return <div className="p-4">{body}</div>;

  return (
    <Link href={ordersHrefFor(window, { zone: row.zoneId })} className={ROW_LINK_CLASSNAME}>
      {body}
    </Link>
  );
}

export function RevenueByZonePanel({ zones, window }: { zones: ZoneRevenue[]; window: PeriodWindow }) {
  return (
    <Panel
      title="Revenue by delivery zone"
      description="Money kept per zone, against what was charged to deliver there."
      empty="No orders in this period yet."
      rows={zones.length}
    >
      {zones.slice(0, 8).map((row) => (
        <li key={row.zoneId ?? row.label}>
          <ZoneRow row={row} window={window} />
        </li>
      ))}
      <ReviewZoneFeesLink />
    </Panel>
  );
}
