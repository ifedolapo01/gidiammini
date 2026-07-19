/**
 * ADMIN layer — operational alerts ticker for the Commerce Admin shell.
 * Token-based via semantic status tones; no business branding.
 */
"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useAdminAlerts } from "@/app/admin/hooks/useAdminAlerts";
import { useMarqueeScroll } from "@/app/admin/hooks/useMarqueeScroll";
import { AlertPill } from "@/app/admin/components/AlertPill";

export function MarqueeAlertBar() {
  const { alerts, loading, dismissAlert, refetch } = useAdminAlerts();
  const [isPaused, setIsPaused] = useState(false);

  const { containerRef, trackRef } = useMarqueeScroll({
    itemCount: alerts.length,
    paused: isPaused,
  });

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
          ref={trackRef}
          className="flex items-center whitespace-nowrap"
          style={{ willChange: "transform" }}
        >
          {/* Original alerts */}
          {alerts.map((alert) => (
            <AlertPill key={alert.id} alert={alert} onDismiss={dismissAlert} />
          ))}

          {/* Duplicate alerts for seamless loop */}
          {alerts.map((alert) => (
            <AlertPill key={`${alert.id}-dup`} alert={alert} onDismiss={dismissAlert} />
          ))}
        </div>
      </div>

      {/* Gradient fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-surface via-surface/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-surface via-surface/80 to-transparent z-10 pointer-events-none" />

      {/* Refresh button */}
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20">
        <button
          onClick={refetch}
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
