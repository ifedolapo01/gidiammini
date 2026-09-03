/**
 * ADMIN layer — data hook for the operational alerts ticker.
 * Owns fetching, sorting, and dismissal of alert items.
 *
 * What each alert says, and where it comes from, is in
 * app/admin/lib/alert-sources.ts — one source per concern, built from the kit
 * in alert-item.ts. This file runs them, orders the result and holds it, which
 * is all a hook should do; before the split it was six copies of "fetch, read
 * a count, push a sentence" in one 200-line effect.
 *
 * The sources run in parallel and each answers with an empty list rather than
 * an error, so the bar no longer loses five alerts because one endpoint is
 * down — which is what the old single try/catch around a sequential chain did.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { onOrdersChanged } from "../lib/orderEvents";
import { ALERT_SOURCES } from "../lib/alert-sources";
import type { AlertItem, AlertTone } from "../lib/alert-item";

// Re-exported: the ticker and the pill import these types from the hook, and
// where the shapes live is not their business.
export type { AlertItem, AlertTone };

export function useAdminAlerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);

      const collected = await Promise.all(ALERT_SOURCES.map((source) => source()));

      // Lowest priority number first — see AlertItem.priority.
      setAlerts(collected.flat().sort((a, b) => a.priority - b.priority));
    } catch (error) {
      // A source cannot get here on its own; this is the orchestration itself
      // failing, which the operator should be told about rather than shown an
      // empty bar.
      console.error("Error fetching alerts:", error);

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
