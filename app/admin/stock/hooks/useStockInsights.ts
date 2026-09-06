/** ADMIN layer — the ledger's reading of the variants currently on screen.
 *
 * Asked for after the rows arrive, not alongside them. The stock table has to
 * render the moment the catalogue query returns — the count is the thing
 * somebody came for — and the movement history is a second, slower question
 * whose answer decorates rows that are already useful. Blocking the table on
 * it would make every page load as slow as the slower of the two.
 *
 * Returns a Map keyed by variant id so a row can look itself up without the
 * table sorting or filtering an array on every render.
 */
'use client';

import { useEffect, useState } from 'react';
import type { VariantInsight } from '@/lib/commerce/inventory-analytics';

export interface StockInsights {
  byVariant: Map<string, VariantInsight>;
  /** Days of ledger behind these figures. 0 means the ledger is empty and the
   *  table should show nothing rather than a column of dashes. */
  observedDays: number;
}

const EMPTY: StockInsights = { byVariant: new Map(), observedDays: 0 };

export function useStockInsights(variantIds: (string | null | undefined)[]): StockInsights {
  const [insights, setInsights] = useState<StockInsights>(EMPTY);

  // The ids as one string, so the effect re-runs when the page of rows changes
  // and not when the array is merely rebuilt by a re-render.
  const key = variantIds.filter(Boolean).sort().join(',');

  useEffect(() => {
    if (!key) {
      setInsights(EMPTY);
      return;
    }

    let active = true;

    (async () => {
      try {
        const response = await fetch(`/api/admin/stock/insights?variantIds=${encodeURIComponent(key)}`);
        if (!response.ok) throw new Error(`Insights request failed: ${response.status}`);

        const data = await response.json();
        if (!active) return;

        setInsights({
          byVariant: new Map(
            (data.insights ?? []).map((insight: VariantInsight) => [insight.variantId, insight])
          ),
          observedDays: data.observedDays ?? 0,
        });
      } catch (error) {
        // Not surfaced. The table's own numbers are unaffected, and an error
        // banner over a decoration is noise about something nobody asked for.
        console.error('Error loading stock insights:', error);
        if (active) setInsights(EMPTY);
      }
    })();

    return () => {
      active = false;
    };
  }, [key]);

  return insights;
}
