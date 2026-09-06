/** ADMIN layer — the three inventory reports, fetched together.
 *
 * One request, because they are one screen. Not polled: unlike the stock table
 * these figures move over weeks, and a report that reshuffles under the reader
 * every sixty seconds while they are deciding what to buy is worse than a
 * stale one with a Refresh button.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { VariantInsight } from '@/lib/commerce/inventory-analytics';
import type { SizeInsight } from '@/lib/commerce/size-demand';

/** A variant insight with enough of the catalogue attached to name it. */
export interface ReportRow extends VariantInsight {
  productId: string;
  productName: string;
  label: string;
  stock: number;
  /** Value on the shelf at cost, or null where no cost is recorded. */
  tiedUpValue: number | null;
}

export interface StockReports {
  windowDays: number;
  /** Days of ledger the whole report rests on. */
  observedDays: number;
  policy: { leadDays: number; coverDays: number };
  reorder: ReportRow[];
  aging: ReportRow[];
  sizes: SizeInsight[];
  totals: {
    variantsConsidered: number;
    agingCount: number;
    reorderCount: number;
    tiedUpValue: number;
  };
}

const EMPTY: StockReports = {
  windowDays: 90,
  observedDays: 0,
  policy: { leadDays: 14, coverDays: 30 },
  reorder: [],
  aging: [],
  sizes: [],
  totals: { variantsConsidered: 0, agingCount: 0, reorderCount: 0, tiedUpValue: 0 },
};

export function useStockReports(windowDays: number) {
  const [reports, setReports] = useState<StockReports>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/stock/aging?windowDays=${windowDays}`);
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Could not load the stock reports.');
      }

      setReports(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the stock reports.');
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    load();
  }, [load]);

  return { reports, loading, error, reload: load };
}
