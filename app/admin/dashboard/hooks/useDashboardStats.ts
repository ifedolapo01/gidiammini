/** ADMIN layer — data-fetching hook for the dashboard page. */
'use client';

import { useState, useEffect } from 'react';
import { ADMIN_POLL_INTERVAL_MS } from '../../lib/adminPolling';
import type { MarginTotals } from '@/lib/commerce/margin';
import { DEFAULT_STORE_SETTINGS } from '@/lib/commerce/store-settings';
import { adminFetch } from '@/app/admin/lib/admin-fetch';

export interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  /** Money actually received and kept, across every non-cancelled order:
   *  payments less completed refunds. Not the value of orders placed — see
   *  app/api/admin/dashboard/route.ts. */
  totalRevenue: number;
  /** Sent back out. Shown beside revenue rather than folded silently into it,
   *  because "we took 900,000 and gave 120,000 back" and "we took 780,000" are
   *  the same net figure and very different businesses. */
  totalRefunded: number;
  /** Still owed on orders the shop intends to fulfil. */
  outstanding: number;
  /** Orders holding some money, but not enough. */
  partPaidOrders: number;
  /** null until loaded, or when the dashboard query failed. */
  margin: MarginTotals | null;
  /** store_settings.low_stock_threshold, as the route applied it. Carried in
   *  the payload rather than fetched separately so the panel and the query it
   *  describes can never disagree. */
  lowStockThreshold: number;
  recentOrders: any[];
  lowStockProducts: any[];
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    totalRefunded: 0,
    outstanding: 0,
    partPaidOrders: 0,
    margin: null,
    lowStockThreshold: DEFAULT_STORE_SETTINGS.lowStockThreshold,
    recentOrders: [],
    lowStockProducts: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch dashboard stats
      const response = await adminFetch('/api/admin/dashboard');

      if (!response.ok) {
        if (response.status === 401) {
          // adminFetch has already triggered the session-expiry toast, cookie
          // clear and redirect to /admin/login. Deliberately leaving `loading`
          // true (skipping the finally below) rather than resetting it: the
          // alternative is a flash of either the empty/zeroed stats or this
          // hook's own "Error Loading Dashboard" banner with a Retry button
          // that would just 401 again, in the moment before the redirect
          // actually completes. The skeleton is the more honest thing to show
          // for a page that is about to be navigated away from anyway.
          return;
        }

        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to fetch dashboard statistics');
      }

      const data = await response.json();
      setStats(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setError(error instanceof Error ? error.message : 'Failed to load dashboard data');
      setLoading(false);
    }
  };

  /** Background poll — updates stats without the loading spinner or clobbering
   * the page with an error banner over a transient network hiccup. */
  const syncStatsSilently = async () => {
    try {
      const response = await adminFetch('/api/admin/dashboard');
      if (response.ok) setStats(await response.json());
    } catch (error) {
      console.error('Error syncing dashboard stats:', error);
    }
  };

  useEffect(() => {
    const interval = setInterval(syncStatsSilently, ADMIN_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return { stats, loading, error, fetchDashboardStats };
}
