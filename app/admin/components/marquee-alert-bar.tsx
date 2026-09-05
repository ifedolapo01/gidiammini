/**
 * ADMIN layer — the compact alerts indicator, for every page that is not the
 * dashboard.
 *
 * This used to be the only place operational alerts appeared, which made a
 * rotating one-at-a-time ticker the whole information architecture: the count
 * you needed was whichever one was currently scrolled off. The worklist on the
 * dashboard is now where the work is read and done (see
 * dashboard/components/today/TodayPanel.tsx), and this is demoted to what a
 * ticker is actually good at — telling you, while you are somewhere else,
 * that something has come in.
 *
 * So it is slimmer, it says how many there are in total, and its count is a
 * link to the panel that lists them. It renders nothing at all when there is
 * nothing to say: a permanent "all systems normal" strip is a row of pixels
 * that has never once changed anybody's next action.
 *
 * The parts worth keeping are kept: it pauses on hover, it respects
 * prefers-reduced-motion, and an item can still be dismissed.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { useAdminAlerts, type AlertItem } from "@/app/admin/hooks/useAdminAlerts";
import { useAlertCycle } from "@/app/admin/hooks/useAlertCycle";
import { AlertPill } from "@/app/admin/components/AlertPill";
import { cn } from "@/lib/utils";

/** Transition duration, in ms — kept in sync with --duration-slow in globals.css. */
const TRANSITION_MS = 300;

export function MarqueeAlertBar() {
  const { alerts, loading, dismissAlert } = useAdminAlerts();
  const [isPaused, setIsPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

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

  // Nothing to say, or nothing known yet. Either way, no strip: this sits
  // above every admin page, and a bar that appears and disappears on load
  // shifts the whole layout under the pointer.
  if (loading || alerts.length === 0 || !current) return null;

  // Only the workable items count here. "3 things waiting" must mean the same
  // number the dashboard's Today panel shows, or the link is a lie.
  const work = alerts.filter((alert) => alert.task).length;

  return (
    <div
      className="relative z-50 h-9 overflow-hidden border-b border-border bg-surface"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* The count, and the way to the worklist. The one thing this bar owes
          the operator is a route to the whole picture. */}
      <Link
        href="/admin/dashboard"
        className="absolute left-3 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1.5 rounded-full border border-border bg-background-tertiary px-2.5 py-0.5 text-caption-md font-medium text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-focus"
      >
        <ListChecks className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">
          {work > 0 ? `${work} to do` : `${alerts.length} update${alerts.length === 1 ? "" : "s"}`}
        </span>
        <span className="sm:hidden">{work > 0 ? work : alerts.length}</span>
      </Link>

      {/* One alert at a time — the next rises up from below as the previous
          slides up and out, like a vertical carousel. */}
      <div className="absolute inset-0 overflow-hidden pl-24 pr-4 sm:pl-32">
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
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            !reduceMotion && "animate-tickerPushUp",
          )}
        >
          <AlertPill alert={current} onDismiss={dismissAlert} />
        </div>
      </div>
    </div>
  );
}
