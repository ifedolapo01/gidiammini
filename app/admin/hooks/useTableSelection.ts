/** ADMIN layer — multi-select state for a table, shared by the products,
 * orders and stock lists.
 *
 * Selection is pruned to the rows currently on screen rather than remembered
 * across pages. Cross-page selection sounds helpful and behaves badly: an
 * operator who pages away, changes a filter and then hits "Deactivate" has no
 * way to see what they are about to act on.
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export function useTableSelection(visibleIds: string[]) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());

  // Joined rather than the array itself: a new array identity every render
  // would re-run this on every render.
  const visibleKey = visibleIds.join('|');

  useEffect(() => {
    setSelected((current) => {
      if (current.size === 0) return current;
      const visible = new Set(visibleIds);
      const next = new Set([...current].filter((id) => visible.has(id)));
      return next.size === current.size ? current : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey]);

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Select or deselect a group of rows at once — the stock table's grouped
   * parent row toggles all of a product's variants this way. */
  const setMany = useCallback((ids: string[], shouldSelect: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (shouldSelect) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const toggleAll = useCallback(() => {
    setSelected((current) => (current.size === visibleIds.length ? new Set() : new Set(visibleIds)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey]);

  const selectedIds = useMemo(() => [...selected], [selected]);

  return {
    selected,
    selectedIds,
    count: selected.size,
    isSelected: useCallback((id: string) => selected.has(id), [selected]),
    toggle,
    toggleAll,
    setMany,
    clear,
    allVisibleSelected: visibleIds.length > 0 && selected.size === visibleIds.length,
    someVisibleSelected: selected.size > 0 && selected.size < visibleIds.length,
  };
}

export type TableSelection = ReturnType<typeof useTableSelection>;
