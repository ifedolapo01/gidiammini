/**
 * ADMIN layer — operational alerts ticker for the Commerce Admin shell.
 * Token-based via semantic status tones; no business branding.
 */
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
import { cn } from "@/lib/utils";

type AlertTone = "destructive" | "warning" | "info" | "accent";

const toneClasses: Record<AlertTone, string> = {
  destructive: "bg-destructive-background text-destructive border-destructive-border",
  warning: "bg-warning-background text-warning border-warning-border",
  info: "bg-info-background text-info border-info-border",
  accent: "bg-accent/10 text-accent border-accent/30",
};

interface AlertItem {
  id: string;
  type: "stock" | "out-of-stock" | "pending-orders" | "system" | "low-stock";
  message: string;
  link: string;
  tone: AlertTone;
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
            tone: "warning",
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
              tone: "accent",
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
              tone: "info",
              count: stats.totalProducts,
              priority: 5,
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

    // Accessibility: no auto-scroll for users who prefer reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let lastTime = 0;

    const animate = (timestamp: number) => {
      if (!lastTime) lastTime = timestamp;
      const delta = timestamp - lastTime;
      lastTime = timestamp;

      if (!isPaused && marqueeRef.current && containerRef.current) {
        positionRef.current -= speedRef.current * (delta / 16);

        const marqueeWidth = marqueeRef.current.scrollWidth / 2; // Divided by 2 because we duplicate

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
        return <AlertTriangle className="size-4 animate-pulse" />;
      case "low-stock":
        return <Package className="size-4" />;
      case "pending-orders":
        return <ShoppingBag className="size-4" />;
      case "system":
        return <Bell className="size-4" />;
      default:
        return <AlertCircle className="size-4" />;
    }
  };

  // Format message with count if available
  const formatMessage = (alert: AlertItem) => {
    if (alert.count !== undefined) {
      return alert.message.replace(/\d+/, alert.count.toString());
    }
    return alert.message;
  };

  const AlertPill = ({ alert }: { alert: AlertItem }) => (
    <div
      className={cn(
        "flex items-center px-4 py-1.5 mx-3 rounded-full border shadow-elevation-1",
        toneClasses[alert.tone],
      )}
    >
      <div className="mr-2">{getAlertIcon(alert.type)}</div>

      <span className="text-body-sm font-medium mr-3">{formatMessage(alert)}</span>

      <Link
        href={alert.link}
        className="flex items-center text-caption-md bg-surface/50 hover:bg-surface/80 text-text-primary px-2 py-1 rounded-control transition-colors"
      >
        View
        <ChevronRight className="size-3 ml-0.5" aria-hidden="true" />
      </Link>

      <button
        onClick={() => dismissAlert(alert.id)}
        className="ml-2 p-1 hover:bg-text-primary/5 rounded-full transition-colors opacity-60 hover:opacity-100"
        aria-label="Dismiss alert"
      >
        <X className="size-3" aria-hidden="true" />
      </button>

      {/* Separator */}
      <div className="ml-6 w-1 h-1 rounded-full bg-border-strong" />
    </div>
  );

  if (loading) {
    return (
      <div className="relative z-50 h-10 bg-background-secondary border-b border-border">
        <div className="container mx-auto px-4 h-full flex items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse"></div>
            <span className="text-body-sm text-text-muted font-medium">Checking systems...</span>
          </div>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="relative z-50 h-10 bg-success-background border-b border-success-border text-success">
        <div className="container mx-auto px-4 h-full flex items-center justify-center">
          <span className="text-body-sm font-medium flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success"></div>
            All systems normal - No alerts
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative z-50 h-10 overflow-hidden bg-surface border-b border-border shadow-elevation-1"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Control indicators */}
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20">
        <div className="text-caption-md bg-background-tertiary text-text-secondary px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-border font-medium shadow-elevation-1">
          {isPaused ? (
            <span className="w-2 h-2 rounded-sm bg-text-muted"></span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          )}
          <span className="hidden sm:inline">
            {alerts.length} Alert{alerts.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Marquee container */}
      <div ref={containerRef} className="absolute inset-0 flex items-center">
        <div
          ref={marqueeRef}
          className="flex items-center whitespace-nowrap"
          style={{ willChange: "transform" }}
        >
          {/* Original alerts */}
          {alerts.map((alert) => (
            <AlertPill key={alert.id} alert={alert} />
          ))}

          {/* Duplicate alerts for seamless loop */}
          {alerts.map((alert) => (
            <AlertPill key={`${alert.id}-dup`} alert={alert} />
          ))}
        </div>
      </div>

      {/* Gradient fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-surface via-surface/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-surface via-surface/80 to-transparent z-10 pointer-events-none" />

      {/* Refresh button */}
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20">
        <button
          onClick={fetchAlerts}
          className="text-caption-md bg-surface hover:bg-surface-hover border border-border text-text-secondary px-2.5 py-1.5 rounded-full shadow-elevation-1 transition-colors flex items-center gap-1 font-medium"
          title="Refresh alerts"
        >
          <RefreshCw className="size-3" aria-hidden="true" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </div>
  );
}
