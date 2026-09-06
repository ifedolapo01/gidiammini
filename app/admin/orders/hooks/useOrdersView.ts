/**
 * ADMIN layer — which orders layout the operator last chose, remembered.
 *
 * Same pattern and the same reasoning as useTableDensity: read from storage in
 * an effect rather than during render, so the first client render matches the
 * server's and hydration does not warn. Cards are the default because they are
 * what this page has always been, and because they are the view that works on
 * a phone.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OrdersView } from '../components/OrdersViewToggle';

const STORAGE_KEY = 'admin-orders-view';

export function useOrdersView() {
  const [view, setViewState] = useState<OrdersView>('cards');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'cards' || stored === 'table') setViewState(stored);
    } catch {
      // Storage unavailable; the default stands.
    }
  }, []);

  const setView = useCallback((next: OrdersView) => {
    setViewState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The preference simply will not survive a reload.
    }
  }, []);

  return { view, setView };
}
