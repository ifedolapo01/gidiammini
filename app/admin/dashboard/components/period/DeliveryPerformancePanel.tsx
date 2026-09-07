/** ADMIN layer — delivered orders judged against their promised date, by zone.
 *
 * Same drill-through rule as RevenueByZonePanel: a row links out by zoneId
 * when one exists, and stays inert for the state-fallback ("Unknown") case.
 */
'use client';

import Link from 'next/link';
import type { ZoneDeliveryPerformance } from '@/lib/commerce/delivery-performance';
import {
  Panel,
  ShareBar,
  ordersHrefFor,
  ReviewZoneFeesLink,
  ROW_LINK_CLASSNAME,
  type PeriodWindow,
} from './PeriodPanelShell';

function DeliveryRow({ row, window }: { row: ZoneDeliveryPerformance; window: PeriodWindow }) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate font-medium text-text-primary">{row.label}</span>
        <span
          className={`shrink-0 text-body-sm font-medium ${row.lateRate > 0 ? 'text-destructive' : 'text-success'}`}
        >
          {Math.round(row.lateRate * 100)}% late
        </span>
      </div>
      {/* Skipped at 0% late rather than shown as a sliver — ShareBar's
          1%-minimum width would read as "slightly late" for a zone that was
          never late at all. */}
      {row.lateRate > 0 && <ShareBar share={row.lateRate} tone="bg-destructive" />}
      <p className="mt-1 text-caption-md text-text-secondary">
        {row.late} of {row.delivered} order{row.delivered === 1 ? '' : 's'} late
        {row.late > 0 && <> · {row.avgDaysLate.toFixed(1)} days late on average</>}
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

export function DeliveryPerformancePanel({
  zones,
  window,
}: {
  zones: ZoneDeliveryPerformance[];
  window: PeriodWindow;
}) {
  return (
    <Panel
      title="Delivery performance by zone"
      description="Delivered orders judged against the date each was promised at checkout — worst zone first."
      empty="No orders delivered in this period yet."
      rows={zones.length}
    >
      {zones.slice(0, 8).map((row) => (
        <li key={row.zoneId ?? row.label}>
          <DeliveryRow row={row} window={window} />
        </li>
      ))}
      <ReviewZoneFeesLink />
    </Panel>
  );
}
