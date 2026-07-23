/**
 * CORE-agnostic hook — advances through a fixed number of items on a timer,
 * looping back to the start. No domain knowledge; can drive any single-item-
 * at-a-time rotating display.
 */
"use client";

import { useEffect, useState } from "react";

interface UseAlertCycleOptions {
  /** Number of items currently available to cycle through. */
  itemCount: number;
  /** When true, the timer is held in place on the current item. */
  paused: boolean;
  /** Milliseconds spent on each item before advancing. */
  intervalMs?: number;
}

export function useAlertCycle({ itemCount, paused, intervalMs = 4000 }: UseAlertCycleOptions) {
  const [index, setIndex] = useState(0);

  // Keep the index in range as the item count shrinks/grows (e.g. an alert dismissed).
  useEffect(() => {
    if (index >= itemCount) setIndex(0);
  }, [itemCount, index]);

  useEffect(() => {
    if (itemCount <= 1 || paused) return;

    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % itemCount);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [itemCount, paused, intervalMs]);

  return { index, setIndex };
}
