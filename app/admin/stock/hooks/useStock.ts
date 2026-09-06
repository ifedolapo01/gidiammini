/** ADMIN layer — one page of stock rows, its filters, and the catalogue-wide
 * counts above them.
 *
 * This used to fetch every active product with every variant embedded and poll
 * that every 60 seconds, then derive the summary cards by filtering the array.
 * Both jobs are the server's now: the low-stock threshold travels with the
 * query so "Low stock" means the same thing in the filter and on the card.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { flattenProducts, type FlattenedProduct } from '@/lib/commerce/product-flatten';
import type { AdminProductsSummary } from '@/lib/commerce/admin-products-summary';
import { useListParams } from '../../hooks/useListParams';
import { useListData } from '../../hooks/useListData';
import { useListSummary } from '../../hooks/useListSummary';
import { useAdminRealtime } from '../../hooks/useAdminRealtime';
import { useAdminStoreSettings } from '../../hooks/useAdminStoreSettings';
import { useStockInsights } from './useStockInsights';
import { DEFAULT_STORE_SETTINGS } from '@/lib/commerce/store-settings';

/** Only until the settings arrive. The page used to define its own 5 here,
 *  which is how it came to disagree with the dashboard's 10. */
const SEED_THRESHOLD = DEFAULT_STORE_SETTINGS.lowStockThreshold;

export function useStock() {
  const [lowStockThreshold, setLowStockThreshold] = useState(SEED_THRESHOLD);

  // The shop's setting seeds the control; the control still overrides it for
  // this session. Both are wanted: "low stock" should mean what the shop says
  // it means by default, and somebody doing a reorder round should still be
  // able to ask "what is down to 20 or fewer" without changing it for everyone.
  const { lowStockThreshold: savedThreshold } = useAdminStoreSettings();
  const thresholdTouched = useRef(false);

  useEffect(() => {
    // Once, when the settings land, and never over a value the operator typed.
    if (thresholdTouched.current) return;
    setLowStockThreshold(savedThreshold);
  }, [savedThreshold]);

  const changeThreshold = useCallback((value: number) => {
    thresholdTouched.current = true;
    setLowStockThreshold(value);
  }, []);

  const params = useListParams({
    sort: 'stock',
    direction: 'asc',
    filters: {
      stock: 'all',
      category: '',
      lowStockThreshold: String(SEED_THRESHOLD),
    },
  });

  const { setFilter } = params;

  // The threshold is a control on this page but a filter parameter to the
  // server, so it has to travel in both directions.
  useEffect(() => {
    setFilter('lowStockThreshold', String(lowStockThreshold));
  }, [lowStockThreshold, setFilter]);

  const { items: rows, meta, loading, error, refreshSilently } = useListData<any>(
    '/api/admin/products/stock',
    params.queryString,
    'products'
  );

  // The one page where a live figure matters most: stock moves without anybody
  // on this screen doing anything, every time an order is confirmed.
  const { connected: live } = useAdminRealtime(['product_variants'], refreshSilently);

  const { summary, reloadSummary } = useListSummary<AdminProductsSummary>(
    '/api/admin/products/summary',
    `lowStockThreshold=${lowStockThreshold}`,
    refreshSilently,
    live
  );

  const reconcile = useCallback(async () => {
    await Promise.all([refreshSilently(), reloadSummary()]);
  }, [refreshSilently, reloadSummary]);

  const products: FlattenedProduct[] = flattenProducts(rows);

  // A second, slower question over the rows already on screen: how fast each
  // variant is selling and how long it will last. Deliberately not part of the
  // list query — see useStockInsights.
  const insights = useStockInsights(products.map((product) => product.variantId));

  return {
    params,
    products,
    meta,
    summary,
    loading,
    error,
    live,
    reconcile,
    lowStockThreshold,
    setLowStockThreshold: changeThreshold,
    insights: insights.byVariant,
  };
}
