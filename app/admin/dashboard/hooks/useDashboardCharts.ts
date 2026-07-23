/** ADMIN layer — data-fetching hook for the dashboard's Analytics section. */
'use client';

import { useEffect, useState, useCallback } from 'react';
import type { DailyPoint, StatusCount, ProductSales } from '@/lib/commerce/dashboard-analytics';
import { ADMIN_POLL_INTERVAL_MS } from '../../lib/adminPolling';

export type TrendRange = 7 | 30 | 90;

export interface DashboardCharts {
  revenueTrend: DailyPoint[];
  orderTrend: DailyPoint[];
  statusBreakdown: StatusCount[];
  topProducts: ProductSales[];
}

const EMPTY_CHARTS: DashboardCharts = {
  revenueTrend: [],
  orderTrend: [],
  statusBreakdown: [],
  topProducts: []
};

export function useDashboardCharts() {
  const [range, setRange] = useState<TrendRange>(30);
  const [charts, setCharts] = useState<DashboardCharts>(EMPTY_CHARTS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCharts = useCallback(async (nextRange: TrendRange, isInitial: boolean) => {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const response = await fetch(`/api/admin/dashboard/charts?range=${nextRange}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard charts');

      setCharts(await response.json());
    } catch (err) {
      console.error('Error fetching dashboard charts:', err);
      setError('Failed to load chart data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCharts(range, charts === EMPTY_CHARTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, fetchCharts]);

  // Background poll — skips `loading`/`refreshing` entirely so charts refresh
  // without the range-switch dimming effect kicking in every interval tick.
  const syncChartsSilently = useCallback(async (activeRange: TrendRange) => {
    try {
      const response = await fetch(`/api/admin/dashboard/charts?range=${activeRange}`);
      if (response.ok) setCharts(await response.json());
    } catch (err) {
      console.error('Error syncing dashboard charts:', err);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => syncChartsSilently(range), ADMIN_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [range, syncChartsSilently]);

  return { charts, range, setRange, loading, refreshing, error };
}
