/**
 * ADMIN layer — which columns of a table the operator has hidden, remembered.
 *
 * Per table rather than shared, unlike density: hiding "Kept" on the customer
 * list says nothing about whether the stock table should hide its category.
 * The key names the table.
 *
 * WHAT IS STORED IS THE HIDDEN SET, NOT THE VISIBLE ONE
 *
 * Storing the visible list would mean a column added in a later release is
 * absent from everybody's stored value and therefore invisible until they went
 * looking for it. Storing what was hidden makes new columns show up by
 * default, which is the only safe direction for this to fail in.
 *
 * Read in an effect rather than during render, for the same hydration reason
 * as useTableDensity: the first paint shows every column, then settles.
 *
 * HIDING THE SORTED COLUMN DOES NOT RESET THE SORT
 *
 * The sort is a query parameter and stays where it is, so the rows do not move
 * under someone who was only tidying the view — reordering two hundred rows as
 * a side effect of hiding a column would be far more surprising than losing
 * sight of the arrow. Showing the column again brings the indicator back.
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TableColumn } from '../components/table';

const EMPTY: ReadonlySet<string> = new Set();

/** `columns` must be a stable reference — define it at module scope. */
export function useColumnVisibility(storageKey: string, columns: TableColumn[]) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(EMPTY);

  /** The columns this table allows to be hidden at all. */
  const hideable = useMemo(() => columns.filter((column) => column.hideable !== false), [columns]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      // Filtered against the current definition, so a key that has since been
      // removed — or made non-hideable — cannot hide anything.
      const allowed = new Set(hideable.map((column) => column.key));
      setHidden(new Set(parsed.filter((key): key is string => typeof key === 'string' && allowed.has(key))));
    } catch {
      // Storage unavailable or the value is not ours. Show everything.
    }
  }, [storageKey, hideable]);

  const persist = useCallback(
    (next: ReadonlySet<string>) => {
      setHidden(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // The choice simply will not survive a reload.
      }
    },
    [storageKey],
  );

  const toggle = useCallback(
    (key: string) => {
      const next = new Set(hidden);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persist(next);
    },
    [hidden, persist],
  );

  const showAll = useCallback(() => persist(new Set()), [persist]);

  const isVisible = useCallback((key: string) => !hidden.has(key), [hidden]);

  const visibleColumns = useMemo(
    () => columns.filter((column) => !hidden.has(column.key)),
    [columns, hidden],
  );

  return { hidden, hideable, isVisible, visibleColumns, toggle, showAll, hiddenCount: hidden.size };
}

/** What a row renderer needs to keep its cells lined up with the header. */
export type ColumnVisibility = (key: string) => boolean;
