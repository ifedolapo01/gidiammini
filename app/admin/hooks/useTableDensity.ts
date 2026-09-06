/**
 * ADMIN layer — comfortable or compact rows, remembered.
 *
 * One preference across every admin table rather than one per page: an
 * operator who wants to see more rows wants that everywhere, and having to
 * set it again on each screen is the kind of setting people stop using.
 *
 * Stored in localStorage, read once on mount rather than during render, so the
 * server-rendered markup and the first client render agree and hydration does
 * not warn. The first paint is therefore always comfortable, which is the
 * safer of the two to be briefly wrong about — it shifts rows closer together
 * rather than further apart.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TableDensity } from '../components/table/table-styles';

const STORAGE_KEY = 'admin-table-density';

function isDensity(value: unknown): value is TableDensity {
  return value === 'comfortable' || value === 'compact';
}

export function useTableDensity() {
  const [density, setDensityState] = useState<TableDensity>('comfortable');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isDensity(stored)) setDensityState(stored);
    } catch {
      // Private browsing, or storage disabled. The default is fine.
    }
  }, []);

  const setDensity = useCallback((next: TableDensity) => {
    setDensityState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not worth surfacing: the preference simply will not survive a reload.
    }
  }, []);

  return { density, setDensity };
}
