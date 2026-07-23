/** ADMIN layer — data-fetching hook for the dashboard page. */
'use client';

import { useState, useEffect } from 'react';
import { ADMIN_POLL_INTERVAL_MS } from '../../lib/adminPolling';

export interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  recentOrders: any[];
  lowStockProducts: any[];
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
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

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard statistics');
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setError('Failed to load dashboard data');
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
