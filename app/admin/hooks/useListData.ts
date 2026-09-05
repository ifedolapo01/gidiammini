/** ADMIN layer — fetching one page of a server-paged admin list.
 *
 * Refetches whenever the query string changes, and exposes a silent refresh
 * for the change-cursor poll and for post-mutation reconciliation, so neither
 * flashes a loading state over data already on screen.
 *
 * A request whose query string is no longer current is discarded rather than
 * applied: typing into a search box fires several overlapping fetches and the
 * slowest one must not win.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

const EMPTY_META: ListMeta = { page: 1, limit: 25, total: 0, totalPages: 0, hasMore: false };

export function useListData<T>(endpoint: string, queryString: string, itemsKey: string) {
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<ListMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // The query string the newest request was issued for. A response arriving
  // for anything else is stale.
  const currentQuery = useRef(queryString);

  const load = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const query = queryString;
      currentQuery.current = query;

      if (!options.silent) {
        setLoading(true);
        setError('');
      }

      try {
        const response = await fetch(`${endpoint}?${query}`);
        const result = await response.json().catch(() => null);

        if (currentQuery.current !== query) return;

        if (!response.ok || !result?.success) {
          throw new Error(result?.error || `Request failed (${response.status})`);
        }

        setItems(result[itemsKey] ?? []);
        setMeta(result.meta ?? EMPTY_META);
        setError('');
      } catch (caught: any) {
        if (currentQuery.current !== query) return;
        console.error(`Error loading ${endpoint}:`, caught);
        if (!options.silent) setError(caught.message || 'Failed to load. Please check your connection.');
      } finally {
        if (currentQuery.current === query && !options.silent) setLoading(false);
      }
    },
    [endpoint, queryString, itemsKey]
  );

  useEffect(() => {
    load();
  }, [load]);

  const refreshSilently = useCallback(() => load({ silent: true }), [load]);

  return { items, meta, loading, error, refreshSilently };
}
