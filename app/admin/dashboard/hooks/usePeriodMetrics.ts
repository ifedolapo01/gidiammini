/** ADMIN layer — the dashboard's period figures, for the selected range.
 *
 * The range lives in this hook rather than in the page, because everything on
 * the period row moves together: changing it must not leave one card showing
 * last week beside another showing last month.
 *
 * Not polled. These are weeks of history summarised — they do not move
 * meaningfully in a minute, and a dashboard that reshuffles under somebody
 * mid-sentence is harder to read than a slightly stale one. The operational
 * panels above (TodayPanel, the stats grid) keep their own live behaviour.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_RANGE, rangeFor, type RangePreset } from '@/lib/commerce/date-range';
import type { PeriodDeltas, PeriodMetrics } from '@/lib/commerce/period-metrics';
import type { CategoryRevenue, ZoneRevenue } from '@/lib/commerce/revenue-breakdown';

export interface PeriodResponse {
  current: PeriodMetrics;
  previous: PeriodMetrics;
  deltas: PeriodDeltas;
  byCategory: CategoryRevenue[];
  byZone: ZoneRevenue[];
  /** True when a query hit its row cap, which makes the repeat rate a figure
   *  over partial history. Surfaced rather than swallowed. */
  truncated: boolean;
}

const EMPTY_METRICS: PeriodMetrics = {
  revenue: 0,
  orders: 0,
  paidOrders: 0,
  cancelledOrders: 0,
  averageOrderValue: null,
  cancellationRate: null,
  repeatCustomerRate: null,
  customers: 0,
};

const EMPTY: PeriodResponse = {
  current: EMPTY_METRICS,
  previous: EMPTY_METRICS,
  deltas: {
    revenue: null,
    orders: null,
    averageOrderValue: null,
    cancellationRate: null,
    repeatCustomerRate: null,
    customers: null,
  },
  byCategory: [],
  byZone: [],
  truncated: false,
};

export function usePeriodMetrics() {
  const [range, setRange] = useState<RangePreset>(DEFAULT_RANGE);
  const [data, setData] = useState<PeriodResponse>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/dashboard/period?range=${range}`);
      const body = await response.json().catch(() => null);

      if (!response.ok || !body?.success) {
        throw new Error(body?.error || 'Could not load the figures for that period.');
      }

      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the figures for that period.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  // Recomputed client-side rather than read from the response, so the
  // drill-through links are built from the same window the cards are labelled
  // with even while a new range is still loading.
  const { current } = rangeFor(range);

  return { range, setRange, data, loading, error, reload: load, window: current };
}
