/** ADMIN layer — the query state every server-paged admin table holds.
 *
 * Page, page size, sort, search and filters live here and are serialised into
 * the query string the list endpoints read. The point is that no admin table
 * filters or sorts an array in the browser any more: the state the operator
 * sets is the state the database is asked about.
 *
 * Search is debounced because it is typed. Every other change applies at once.
 */
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type SortDirection = 'asc' | 'desc';

export interface ListParamsInit {
  sort: string;
  direction?: SortDirection;
  limit?: number;
  /** Filter name -> initial value. An empty value is omitted from the query. */
  filters?: Record<string, string>;
  /**
   * Keep the URL in sync with every later page/sort/search/filter change, not
   * only the values it was seeded from. Opt-in and false by default: every
   * other caller of this hook (products, customers, stock) reads the URL once
   * to seed state and never touches it again, and turning this on for them
   * unasked would start rewriting URLs nobody asked to be shareable.
   */
  syncUrl?: boolean;
}

const SEARCH_DEBOUNCE_MS = 300;

export function useListParams(init: ListParamsInit) {
  const syncUrl = init.syncUrl ?? false;
  const pathname = usePathname();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [limit, setLimitState] = useState(init.limit ?? 25);
  const [sort, setSortState] = useState(init.sort);
  const [direction, setDirectionState] = useState<SortDirection>(init.direction ?? 'desc');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>(init.filters ?? {});

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // A narrowed result set almost never has the page the operator was on, and
  // landing on an empty page reads as "no results" rather than "page 4 of 1".
  useEffect(() => setPage(1), [debouncedSearch]);

  const setFilter = useCallback((key: string, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const setSort = useCallback((next: string, nextDirection: SortDirection) => {
    setPage(1);
    setSortState(next);
    setDirectionState(nextDirection);
  }, []);

  const setLimit = useCallback((next: number) => {
    setPage(1);
    setLimitState(next);
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sort,
      direction,
    });
    if (debouncedSearch) params.set('search', debouncedSearch);
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    return params.toString();
  }, [page, limit, sort, direction, debouncedSearch, filters]);

  // Opt-in only. This is what makes a filtered/sorted/paged view survive a
  // copy-pasted URL — today it only reads the URL once, at mount, to seed
  // state. debouncedSearch is already inside queryString's own dependency
  // list, so no separate debounce is needed here.
  useEffect(() => {
    if (!syncUrl) return;
    router.replace(`${pathname}?${queryString}`, { scroll: false });
  }, [syncUrl, pathname, queryString, router]);

  return {
    page,
    setPage,
    limit,
    setLimit,
    sort,
    direction,
    setSort,
    search,
    setSearch,
    filters,
    setFilter,
    queryString,
  };
}

export type ListParamsState = ReturnType<typeof useListParams>;
