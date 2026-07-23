/**
 * ADMIN layer — data hook for the operational alerts ticker.
 * Owns fetching, sorting, and dismissal of alert items.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { onOrdersChanged } from "../lib/orderEvents";

export type AlertTone = "destructive" | "warning" | "info" | "accent";

export interface AlertItem {
  id: string;
  type: "stock" | "out-of-stock" | "overdue-shipping" | "pending-orders" | "pending-change-requests" | "system" | "low-stock";
  message: string;
  link: string;
  tone: AlertTone;
  count?: number;
  priority: number;
}

export function useAdminAlerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all alerts
  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);

      const newAlerts: AlertItem[] = [];

      // 1. Fetch stock alerts
      const stockResponse = await fetch("/api/admin/products/negative-stock");
      if (stockResponse.ok) {
        const stockData = await stockResponse.json();

        // Add out of stock alert
        if (stockData.outOfStockCount > 0) {
          newAlerts.push({
            id: `out-of-stock-${Date.now()}`,
            type: "out-of-stock",
            message: `🚨 ${stockData.outOfStockCount} product${
              stockData.outOfStockCount > 1 ? "s are" : " is"
            } OUT OF STOCK`,
            link: "/admin/stock",
            tone: "destructive",
            count: stockData.outOfStockCount,
            priority: 1, // Highest priority
          });
        }

        // Add low stock alert
        if (stockData.lowStockCount > 0) {
          newAlerts.push({
            id: `low-stock-${Date.now()}`,
            type: "low-stock",
            message: `⚠️ ${stockData.lowStockCount} product${
              stockData.lowStockCount > 1 ? "s are" : " is"
            } running LOW on stock (5 or less)`,
            link: "/admin/stock",
            tone: "warning",
            count: stockData.lowStockCount,
            priority: 2,
          });
        }
      }

      // 2. Fetch orders overdue for shipping (confirmed past their zone's ETA window)
      const overdueResponse = await fetch("/api/admin/alerts/overdue-shipments");
      if (overdueResponse.ok) {
        const overdueData = await overdueResponse.json();

        if (overdueData.overdueCount > 0) {
          newAlerts.push({
            id: `overdue-shipping-${Date.now()}`,
            type: "overdue-shipping",
            message: `🚚 ${overdueData.overdueCount} confirmed order${
              overdueData.overdueCount > 1 ? "s are" : " is"
            } PAST their shipping window - update status`,
            link: "/admin/orders?filter=overdue",
            tone: "destructive",
            count: overdueData.overdueCount,
            priority: 2,
          });
        }
      }

      // 3. Fetch pending orders
      const ordersResponse = await fetch("/api/admin/alerts/pending-orders");
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();

        if (ordersData.pendingCount > 0) {
          newAlerts.push({
            id: `pending-orders-${Date.now()}`,
            type: "pending-orders",
            message: `📦 ${ordersData.pendingCount} order${
              ordersData.pendingCount > 1 ? "s are" : " is"
            } PENDING confirmation`,
            link: "/admin/orders",
            tone: "warning",
            count: ordersData.pendingCount,
            priority: 4,
          });
        }
      }

      // 4. Fetch pending order change requests (reschedule / delivery-method-change)
      const changeRequestsResponse = await fetch("/api/admin/alerts/pending-change-requests");
      if (changeRequestsResponse.ok) {
        const changeRequestsData = await changeRequestsResponse.json();

        if (changeRequestsData.pendingCount > 0) {
          newAlerts.push({
            id: `pending-change-requests-${Date.now()}`,
            type: "pending-change-requests",
            message: `🔄 ${changeRequestsData.pendingCount} order change request${
              changeRequestsData.pendingCount > 1 ? "s are" : " is"
            } awaiting review`,
            link: "/admin/orders",
            tone: "warning",
            count: changeRequestsData.pendingCount,
            priority: 5,
          });
        }
      }

      // Add this inside fetchAlerts function, after fetching other alerts
      const statsResponse = await fetch("/api/admin/alerts/dashboard-stats");
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();

        if (statsData.success && statsData.stats) {
          const stats = statsData.stats;

          // Add today's orders alert
          if (stats.todayOrders > 0) {
            newAlerts.push({
              id: `today-orders-${Date.now()}`,
              type: "system",
              message: `📊 ${stats.todayOrders} order${
                stats.todayOrders > 1 ? "s" : ""
              } placed today`,
              link: "/admin/orders",
              tone: "accent",
              count: stats.todayOrders,
              priority: 6,
            });
          }

          // Add total products alert (once a day maybe)
          const shouldShowTotalProducts = Math.random() > 0.7; // 30% chance
          if (shouldShowTotalProducts && stats.totalProducts > 0) {
            newAlerts.push({
              id: `total-products-${Date.now()}`,
              type: "system",
              message: `📦 ${stats.totalProducts} active products in store`,
              link: "/admin/products",
              tone: "info",
              count: stats.totalProducts,
              priority: 7,
            });
          }
        }
      }

      // Sort by priority (lowest number = highest priority)
      newAlerts.sort((a, b) => a.priority - b.priority);

      setAlerts(newAlerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);

      // Fallback to basic system alert
      setAlerts([
        {
          id: "system-error",
          type: "system",
          message: "⚠️ Unable to fetch alerts - check connection",
          link: "/admin/dashboard",
          tone: "destructive",
          priority: 1,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAlerts();

    // Refresh every 2 minutes
    const refreshInterval = setInterval(fetchAlerts, 120000);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [fetchAlerts]);

  // Also refetch immediately whenever an order changes elsewhere in the admin
  // (e.g. a status update), instead of waiting up to 2 minutes for the count to catch up.
  useEffect(() => onOrdersChanged(fetchAlerts), [fetchAlerts]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  }, []);

  return { alerts, loading, dismissAlert, refetch: fetchAlerts };
}
