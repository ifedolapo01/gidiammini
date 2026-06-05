// app/admin/components/marquee-alert-bar.tsx
"use client";

import {
  AlertTriangle,
  X,
  ChevronRight,
  AlertCircle,
  ShoppingBag,
  Package,
  Bell,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

interface AlertItem {
  id: string;
  type: "stock" | "out-of-stock" | "pending-orders" | "system" | "low-stock";
  message: string;
  link: string;
  color: string;
  count?: number;
  priority: number;
}

export function MarqueeAlertBar() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  const marqueeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const positionRef = useRef(0);
  const speedRef = useRef(0.8); // pixels per frame

  // Fetch all alerts
  const fetchAlerts = async () => {
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
            color: "bg-red-50 text-red-700 border-red-200",
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
            color: "bg-orange-50 text-orange-700 border-orange-200",
            count: stockData.lowStockCount,
            priority: 2,
          });
        }
      }

      // 2. Fetch pending orders
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
            color: "bg-yellow-50 text-yellow-700 border-yellow-200",
            count: ordersData.pendingCount,
            priority: 3,
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
              color: "bg-purple-50 text-purple-700 border-purple-200",
              count: stats.todayOrders,
              priority: 4,
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
              color: "bg-blue-50 text-blue-700 border-blue-200",
              count: stats.totalProducts,
              priority: 5,
            });
          }
        }
      }

      // Only add system status if there are no other alerts
      // Actually, we'll let the length === 0 check handle the "All systems normal" UI
      
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
          color: "bg-red-50 text-red-700 border-red-200",
          priority: 1,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchAlerts();

    // Refresh every 2 minutes
    const refreshInterval = setInterval(fetchAlerts, 120000);

    return () => {
      clearInterval(refreshInterval);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Marquee animation
  useEffect(() => {
    if (!marqueeRef.current || !containerRef.current || alerts.length === 0)
      return;

    let lastTime = 0;

    const animate = (timestamp: number) => {
      if (!lastTime) lastTime = timestamp;
      const delta = timestamp - lastTime;
      lastTime = timestamp;

      if (!isPaused && marqueeRef.current && containerRef.current) {
        positionRef.current -= speedRef.current * (delta / 16);

        const marqueeWidth = marqueeRef.current.scrollWidth / 2; // Divided by 2 because we duplicate
        const containerWidth = containerRef.current.offsetWidth;

        // Reset position when entire marquee has scrolled through
        if (Math.abs(positionRef.current) >= marqueeWidth) {
          positionRef.current = 0;
        }

        marqueeRef.current.style.transform = `translateX(${positionRef.current}px)`;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [alerts.length, isPaused]);

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "out-of-stock":
        return <AlertTriangle className="w-4 h-4 animate-pulse" />;
      case "low-stock":
        return <Package className="w-4 h-4" />;
      case "pending-orders":
        return <ShoppingBag className="w-4 h-4" />;
      case "system":
        return <Bell className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  // Format message with count if available
  const formatMessage = (alert: AlertItem) => {
    if (alert.count !== undefined) {
      return alert.message.replace(/\d+/, alert.count.toString());
    }
    return alert.message;
  };

  if (loading) {
    return (
      <div className="relative z-50 h-10 bg-gray-50 border-b border-gray-200">
        <div className="container mx-auto px-4 h-full flex items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-500 font-medium">Checking systems...</span>
          </div>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="relative z-50 h-10 bg-emerald-50 border-b border-emerald-100 text-emerald-700">
        <div className="container mx-auto px-4 h-full flex items-center justify-center">
          <span className="text-sm font-medium flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            All systems normal - No alerts
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative z-50 h-10 overflow-hidden bg-white border-b border-gray-200 shadow-sm"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Control indicators */}
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20">
        <div className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-gray-200 font-medium shadow-sm">
          {isPaused ? <span className="w-2 h-2 rounded-sm bg-gray-500"></span> : <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>}
          <span className="hidden sm:inline">
            {alerts.length} Alert{alerts.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Marquee container */}
      <div ref={containerRef} className="absolute inset-0 flex items-center">
        <div
          ref={marqueeRef}
          className="flex items-center whitespace-nowrap transition-transform duration-0"
          style={{ willChange: "transform" }}
        >
          {/* Original alerts */}
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center px-4 py-1.5 mx-3 rounded-full ${alert.color} shadow-sm border`}
            >
              <div className="mr-2">{getAlertIcon(alert.type)}</div>

              <span className="text-sm font-medium mr-3">
                {formatMessage(alert)}
              </span>

              <Link
                href={alert.link}
                className="flex items-center text-xs bg-white/50 hover:bg-white/80 text-gray-800 px-2 py-1 rounded-md transition-colors"
              >
                View
                <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>

              <button
                onClick={() => dismissAlert(alert.id)}
                className="ml-2 p-1 hover:bg-black/5 rounded-full transition-colors opacity-60 hover:opacity-100"
                aria-label="Dismiss alert"
              >
                <X className="w-3 h-3" />
              </button>

              {/* Separator */}
              <div className="ml-6 w-1 h-1 rounded-full bg-gray-300" />
            </div>
          ))}

          {/* Duplicate alerts for seamless loop */}
          {alerts.map((alert) => (
            <div
              key={`${alert.id}-dup`}
              className={`flex items-center px-4 py-1.5 mx-3 rounded-full ${alert.color} shadow-sm border`}
            >
              <div className="mr-2">{getAlertIcon(alert.type)}</div>

              <span className="text-sm font-medium mr-3">
                {formatMessage(alert)}
              </span>

              <Link
                href={alert.link}
                className="flex items-center text-xs bg-white/50 hover:bg-white/80 text-gray-800 px-2 py-1 rounded-md transition-colors"
              >
                View
                <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>

              <button
                onClick={() => dismissAlert(alert.id)}
                className="ml-2 p-1 hover:bg-black/5 rounded-full transition-colors opacity-60 hover:opacity-100"
                aria-label="Dismiss alert"
              >
                <X className="w-3 h-3" />
              </button>

              <div className="ml-6 w-1 h-1 rounded-full bg-gray-300" />
            </div>
          ))}
        </div>
      </div>

      {/* Gradient fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none" />

      {/* Refresh button */}
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20">
        <button
          onClick={fetchAlerts}
          className="text-xs bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 px-2.5 py-1.5 rounded-full shadow-sm transition-colors flex items-center gap-1 font-medium"
          title="Refresh alerts"
        >
          <RefreshCw className="w-3 h-3" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </div>
  );
}
