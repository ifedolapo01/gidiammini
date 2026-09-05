/** ADMIN layer — the totals above a server-paged admin table, kept live by a
 * realtime subscription where one is available and a change token where it is
 * not.
 *
 * The old arrangement re-fetched every row every 60 seconds so the page could
 * notice a new order. This polls a token instead — a count and a high-water
 * updated_at, a few dozen bytes, no rows — and only when that token moves does
 * it refetch the summary and tell the page to reload its current page of rows.
 *
 * Realtime makes the same signal arrive immediately. It does not replace the
 * poll: pass `live` and the interval stretches to a safety-net cadence rather
 * than stopping, because a dropped socket must not leave the page silently
 * stale.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ADMIN_CURSOR_POLL_INTERVAL_MS, ADMIN_LIVE_POLL_INTERVAL_MS } from '../lib/adminPolling';

export function useListSummary<S>(
  endpoint: string,
  /** Extra query string for the summary itself, e.g. `lowStockThreshold=5`. */
  params: string,
  /** Called when the server data changed under us. */
  onChanged: () => void,
  /** True while a realtime subscription is delivering the same signal. */
  live: boolean = false
) {
  const [summary, setSummary] = useState<S | null>(null);
  const cursor = useRef<string | null>(null);

  // Held in a ref so a new callback identity each render does not restart the
  // polling interval.
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const loadSummary = useCallback(async () => {
    try {
      const response = await fetch(params ? `${endpoint}?${params}` : endpoint);
      if (!response.ok) return;
      const result = await response.json();
      if (!result?.success) return;
      setSummary(result.summary ?? null);
      cursor.current = result.cursor ?? cursor.current;
    } catch (error) {
      console.error(`Error loading summary from ${endpoint}:`, error);
    }
  }, [endpoint, params]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const check = async () => {
      try {
        const response = await fetch(`${endpoint}?cursor=1`);
        if (!response.ok) return;
        const result = await response.json();
        const next = result?.cursor;
        if (typeof next !== 'string') return;

        // The first token seen is the baseline, not a change.
        if (cursor.current !== null && next !== cursor.current) {
          cursor.current = next;
          onChangedRef.current();
          loadSummary();
        } else {
          cursor.current = next;
        }
      } catch (error) {
        console.error(`Error polling ${endpoint} cursor:`, error);
      }
    };

    const interval = setInterval(
      check,
      live ? ADMIN_LIVE_POLL_INTERVAL_MS : ADMIN_CURSOR_POLL_INTERVAL_MS
    );
    return () => clearInterval(interval);
  }, [endpoint, loadSummary, live]);

  return { summary, reloadSummary: loadSummary };
}
