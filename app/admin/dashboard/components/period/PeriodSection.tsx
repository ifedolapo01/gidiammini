/** ADMIN layer — the dashboard's period view: a range, five compared figures,
 *  and where the money came from.
 *
 * Everything on this page used to be all-time, so nothing on it could be
 * compared to anything. One control drives the whole section, so two cards can
 * never be showing different windows.
 *
 * Placed below the all-time stat grid rather than replacing it: "how much have
 * we ever taken" and "how did the last 30 days go" are both real questions,
 * and the second is the one that needs a comparison beside it.
 */
'use client';

import { RotateCcw, ShoppingBag, Users, XCircle } from 'lucide-react';
import { Button, NairaSign, Select } from '@/components/ui';
import {
  RANGE_PRESETS,
  describeComparison,
  describeRange,
  type RangePreset,
} from '@/lib/commerce/date-range';
import { formatCurrency } from '@/lib/commerce/pricing';
import { usePeriodMetrics } from '../../hooks/usePeriodMetrics';
import { PeriodStatCard } from './PeriodStatCard';
import { RevenueByCategoryPanel, RevenueByZonePanel } from './RevenueBreakdownPanels';
import { PeriodSkeleton } from './PeriodSkeleton';

/** A rate as a whole percent, or an em dash when it is undefined — an average
 *  of no orders is not zero. */
function percent(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

export function PeriodSection() {
  const { range, setRange, data, loading, error, reload, window } = usePeriodMetrics();

  const comparison = describeComparison(range);
  // Every drill-through carries the same window the cards were computed over,
  // so the list a card opens is exactly the rows behind that number.
  const ordersHref = `/admin/orders?from=${encodeURIComponent(window.from)}&to=${encodeURIComponent(window.to)}`;

  return (
    <section className="mb-8" aria-labelledby="period-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="period-heading" className="text-h5 font-bold text-text-primary">
            {describeRange(range)}
          </h2>
          <p className="text-body-sm text-text-secondary">
            Every figure below is measured against the period before it.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="dashboard-range" className="sr-only">
            Reporting period
          </label>
          <Select
            id="dashboard-range"
            value={String(range)}
            onChange={(event) => setRange(Number(event.target.value) as RangePreset)}
          >
            {RANGE_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {describeRange(preset)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error ? (
        <div className="rounded-surface border border-destructive-border bg-destructive-background p-4">
          <p className="mb-3 text-body-sm text-destructive">{error}</p>
          <Button variant="destructive" size="sm" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : loading ? (
        <PeriodSkeleton />
      ) : (
        <>
          {data.truncated && (
            <p
              role="status"
              className="mb-4 rounded-control border border-warning-border bg-warning-background p-3 text-body-sm text-warning"
            >
              This shop has more orders than one pass of this report can read, so the repeat-customer
              rate is measured over partial history. The other figures are unaffected.
            </p>
          )}

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <PeriodStatCard
              title="Revenue"
              icon={<NairaSign className="h-5 w-5 text-accent" />}
              iconBgClassName="bg-accent/10"
              value={formatCurrency(data.current.revenue)}
              delta={data.deltas.revenue}
              comparison={comparison}
              subtext={`from ${formatCurrency(data.previous.revenue)}`}
              href={ordersHref}
            />

            <PeriodStatCard
              title="Orders"
              icon={<ShoppingBag className="h-5 w-5 text-primary" />}
              iconBgClassName="bg-primary/10"
              value={data.current.orders}
              delta={data.deltas.orders}
              comparison={comparison}
              subtext={`${data.current.paidOrders} paid`}
              href={ordersHref}
            />

            <PeriodStatCard
              title="Average order"
              icon={<NairaSign className="h-5 w-5 text-success" />}
              iconBgClassName="bg-success-background"
              value={data.current.averageOrderValue === null ? '—' : formatCurrency(data.current.averageOrderValue)}
              delta={data.deltas.averageOrderValue}
              comparison={comparison}
              subtext="revenue ÷ paid orders"
            />

            <PeriodStatCard
              title="Repeat customers"
              icon={<Users className="h-5 w-5 text-info" />}
              iconBgClassName="bg-info-background"
              value={percent(data.current.repeatCustomerRate)}
              delta={data.deltas.repeatCustomerRate}
              comparison={comparison}
              // The denominator, because "50% repeat" over two customers is
              // not a finding and a rate without its base invites acting on
              // one anyway.
              subtext={`of ${data.current.customers} customer${data.current.customers === 1 ? '' : 's'}`}
            />

            <PeriodStatCard
              title="Cancelled"
              icon={<XCircle className="h-5 w-5 text-destructive" />}
              iconBgClassName="bg-destructive-background"
              value={percent(data.current.cancellationRate)}
              delta={data.deltas.cancellationRate}
              comparison={comparison}
              // Fewer cancellations is the good direction, so the badge must
              // not colour a rise green the way it does for revenue.
              goodDirection="down"
              subtext={`${data.current.cancelledOrders} of ${data.current.orders}`}
              href={`${ordersHref}&filter=cancelled`}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RevenueByCategoryPanel categories={data.byCategory} />
            <RevenueByZonePanel zones={data.byZone} />
          </div>
        </>
      )}
    </section>
  );
}
