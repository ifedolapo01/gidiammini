/** ADMIN layer — data-fetching hook for the dashboard page. */
'use client';

import { useState, useEffect } from 'react';
import { ADMIN_POLL_INTERVAL_MS } from '../../lib/adminPolling';
import type { MarginTotals } from '@/lib/commerce/margin';

export interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  /** null until loaded, or when the dashboard query failed. */
  margin: MarginTotals | null;
  recentOrders: any[];
  lowStockProducts: any[];
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    margin: null,
    recentOrders: [],
    lowStockProducts: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch dashboard stats
      const response = await fetch('/api/admin/dashboard');
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // 401 means the admin session itself is invalid/expired (e.g. JWT_SECRET
        // rotated) — surface that distinctly from a genuine server-side failure,
        // since "failed to fetch" reads as a bug when the real fix is re-login.
        if (response.status === 401) {
          throw new Error('Your admin session has expired. Please log in again.');
        }
        throw new Error(data?.error || 'Failed to fetch dashboard statistics');
      }

      setStats(data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setError(error instanceof Error ? error.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  /** Background poll — updates stats without the loading spinner or clobbering
   * the page with an error banner over a transient network hiccup. */
  const syncStatsSilently = async () => {
    try {
      const response = await fetch('/api/admin/dashboard');
      if (response.ok) setStats(await response.json());
    } catch (error) {
      console.error('Error syncing dashboard stats:', error);
    }
  };

  useEffect(() => {
    const interval = setInterval(syncStatsSilently, ADMIN_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { stats, loading, error, fetchDashboardStats };
}
