/** ADMIN layer — the funnel and the traffic-without-sales list, fetched together.
 *
 * One request, because they are one source (storefront_events) read two ways.
 * Consumed by the dashboard's FunnelPanel and the discounts page's
 * TrafficWithoutSalesPanel — the second reuses the "create discount" flow the
 * discounts page already has for MarkdownCandidatesPanel.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/app/admin/lib/admin-fetch';

export type FunnelStage = 'view_item' | 'add_to_cart' | 'begin_checkout' | 'purchase';

export interface FunnelStageCount {
  event: FunnelStage;
  sessions: number;
}

export interface TrafficCandidate {
  productId: string;
  productName: string;
  mainImage: string | null;
  price: number;
  stock: number;
  views: number;
  addToCarts: number;
}

interface StorefrontAnalytics {
  windowDays: number;
  funnel: FunnelStageCount[];
  trafficWithoutSales: TrafficCandidate[];
}

const EMPTY: StorefrontAnalytics = { windowDays: 30, funnel: [], trafficWithoutSales: [] };

export function useStorefrontAnalytics(windowDays: number) {
  const [data, setData] = useState<StorefrontAnalytics>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await adminFetch(`/api/admin/analytics/storefront?windowDays=${windowDays}`);
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Could not load storefront analytics.');
      }

      setData({
        windowDays: payload.windowDays,
        funnel: payload.funnel,
        trafficWithoutSales: (payload.trafficWithoutSales ?? []).map((row: any) => ({
          productId: row.product_id,
          productName: row.product_name,
          mainImage: row.main_image,
          price: row.price,
          stock: row.stock,
          views: Number(row.views) || 0,
          addToCarts: Number(row.add_to_carts) || 0,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load storefront analytics.');
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...data, loading, error, reload: load };
}
