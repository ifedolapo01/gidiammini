/**
 * ADMIN layer — the items behind one worklist count, fetched when asked for.
 *
 * Expansion is the whole reason this exists. The panel arrives with counts,
 * which are cheap; the specific orders behind a count are nine more queries
 * and nobody wants all nine. So one instance of this hook lives with one
 * expandable row and fetches only once that row is opened — and keeps what it
 * fetched, so collapsing and reopening costs nothing.
 *
 * `refresh` is what makes an inline action honest: after marking an order
 * shipped, the row it was in has to stop saying it is overdue.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WorklistEntry, WorklistTask } from '@/types/worklist';

interface UseWorklistTaskResult {
  entries: WorklistEntry[];
  loading: boolean;
  error: string | null;
  /** True when there is more behind the count than the rows returned. */
  truncated: boolean;
  refresh: () => Promise<void>;
}

export function useWorklistTask(task: WorklistTask, enabled: boolean): UseWorklistTaskResult {
  const [entries, setEntries] = useState<WorklistEntry[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Distinguishes "not opened yet" from "opened and empty", so an emptied
  // task shows its cleared state rather than a permanent spinner.
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/worklist/${task}`);
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Could not load these items.');
      }

      setEntries(result.entries ?? []);
      setTruncated(Boolean(result.truncated));
      setLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load these items.');
    } finally {
      setLoading(false);
    }
  }, [task]);

  useEffect(() => {
    if (enabled && !loaded && !loading && !error) load();
    // `loading` and `error` are read rather than depended on: including them
    // would retry a failed fetch the moment it failed, in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loaded, load]);

  return { entries, loading, error, truncated, refresh: load };
}
