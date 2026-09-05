/** ADMIN layer — the undo window in front of every bulk action.
 *
 * A bulk action's blast radius is its whole point and its whole risk: "30% off"
 * on the wrong 60 products is not a mistake anyone can quietly reverse. So the
 * action is held, not applied, for a few seconds while an Undo button is on
 * screen — the same shape as an email client's undo-send.
 *
 * Holding it is deliberate rather than applying-then-reversing. An inverse
 * operation does not exist for most of these: un-shipping an order would emit a
 * second customer notification, and re-raising prices by the same percentage
 * does not land back on the original figures. Nothing has happened yet during
 * the window, so undo is exact.
 *
 * Once the window closes the request goes out and the per-row results are kept
 * for the caller to display — a partial failure has to be visible.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BulkOutcome } from '@/lib/api/bulk';

export const UNDO_WINDOW_SECONDS = 6;

export interface PendingBulkAction {
  /** What is about to happen, in the operator's words. */
  description: string;
  count: number;
  secondsLeft: number;
}

interface ScheduleInput {
  description: string;
  count: number;
  run: () => Promise<BulkOutcome & { success?: boolean; error?: string }>;
}

export function useBulkAction(onApplied: () => void) {
  const [pending, setPending] = useState<PendingBulkAction | null>(null);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<(BulkOutcome & { description: string }) | null>(null);

  const scheduled = useRef<ScheduleInput | null>(null);
  const onAppliedRef = useRef(onApplied);
  onAppliedRef.current = onApplied;

  const commit = useCallback(async () => {
    const action = scheduled.current;
    scheduled.current = null;
    setPending(null);
    if (!action) return;

    setRunning(true);
    try {
      const result = await action.run();
      setOutcome({
        description: action.description,
        results: result.results ?? [],
        succeeded: result.succeeded ?? 0,
        failed: result.failed ?? 0,
      });
    } catch (error: any) {
      setOutcome({
        description: action.description,
        results: [],
        succeeded: 0,
        failed: action.count,
      });
      console.error('Bulk action failed:', error);
    } finally {
      setRunning(false);
      onAppliedRef.current();
    }
  }, []);

  useEffect(() => {
    if (!pending) return;

    // The commit happens in the effect body rather than inside the state
    // updater: an updater must be pure, and firing the request from one would
    // send it twice under StrictMode's double-invoke.
    if (pending.secondsLeft <= 0) {
      commit();
      return;
    }

    const timer = setTimeout(() => {
      setPending((current) => (current ? { ...current, secondsLeft: current.secondsLeft - 1 } : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [pending, commit]);

  // Navigating away is not "undo". The window is seconds long and the operator
  // asked for the change, so it goes out; only the result display is lost.
  useEffect(() => () => {
    if (scheduled.current) {
      const action = scheduled.current;
      scheduled.current = null;
      void action.run().catch((error) => console.error('Bulk action failed after unmount:', error));
    }
  }, []);

  const schedule = useCallback((input: ScheduleInput) => {
    if (scheduled.current) return;
    setOutcome(null);
    scheduled.current = input;
    setPending({ description: input.description, count: input.count, secondsLeft: UNDO_WINDOW_SECONDS });
  }, []);

  const undo = useCallback(() => {
    scheduled.current = null;
    setPending(null);
  }, []);

  return {
    pending,
    running,
    outcome,
    schedule,
    undo,
    applyNow: commit,
    dismissOutcome: useCallback(() => setOutcome(null), []),
    busy: pending !== null || running,
  };
}
