/**
 * ADMIN layer — operational alerts ticker for the Commerce Admin shell.
 * Token-based via semantic status tones; no business branding.
 */
"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useAdminAlerts, type AlertItem } from "@/app/admin/hooks/useAdminAlerts";
import { useAlertCycle } from "@/app/admin/hooks/useAlertCycle";
import { AlertPill } from "@/app/admin/components/AlertPill";
import { cn } from "@/lib/utils";

/** Transition duration, in ms — kept in sync with --duration-slow in globals.css. */
const TRANSITION_MS = 300;

export function MarqueeAlertBar() {
  const { alerts, loading, dismissAlert, refetch } = useAdminAlerts();
  const [isPaused, setIsPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(query.matches);
  }, []);

  const { index } = useAlertCycle({
    itemCount: alerts.length,
    paused: isPaused,
  });

  const activeAlert = alerts[index] ?? alerts[0] ?? null;
  const [current, setCurrent] = useState<AlertItem | null>(activeAlert);
  const [previous, setPrevious] = useState<AlertItem | null>(null);

  // Snapshots the outgoing alert as `previous` (so it can animate off-screen)
  // whenever the active one changes, instead of just swapping instantly.
  useEffect(() => {
    if (!activeAlert || current?.id === activeAlert.id) {
      if (activeAlert && activeAlert !== current) setCurrent(activeAlert);
      return;
    }

    if (reduceMotion) {
      setCurrent(activeAlert);
      return;
    }

    setPrevious(current);
    setCurrent(activeAlert);
    const timer = setTimeout(() => setPrevious(null), TRANSITION_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAlert]);

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

  if (!current) return null;

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

      {/* Current alert, one at a time - the next one rises up from below as the
          previous one slides up and out, like a vertical carousel. */}
      <div className="absolute inset-0 overflow-hidden px-28">
        {previous && (
          <div
            key={`prev-${previous.id}`}
            className="absolute inset-0 flex items-center justify-center animate-tickerPushOut"
          >
            <AlertPill alert={previous} onDismiss={dismissAlert} />
          </div>
        )}
        <div
          key={`current-${current.id}`}
          className={cn("absolute inset-0 flex items-center justify-center", !reduceMotion && "animate-tickerPushUp")}
        >
          <AlertPill alert={current} onDismiss={dismissAlert} />
        </div>
      </div>

      {/* Refresh button */}
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-caption-md bg-surface hover:bg-surface-hover border border-border text-text-secondary px-2.5 py-1.5 rounded-full shadow-elevation-1 transition-colors flex items-center gap-1 font-medium disabled:opacity-60 disabled:pointer-events-none"
          title="Refresh alerts"
        >
          <RefreshCw className={cn("size-3", isRefreshing && "animate-spin")} aria-hidden="true" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </div>
  );
}
