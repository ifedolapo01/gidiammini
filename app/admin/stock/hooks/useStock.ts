/** ADMIN layer — one page of stock rows, its filters, and the catalogue-wide
 * counts above them.
 *
 * This used to fetch every active product with every variant embedded and poll
 * that every 60 seconds, then derive the summary cards by filtering the array.
 * Both jobs are the server's now: the low-stock threshold travels with the
 * query so "Low stock" means the same thing in the filter and on the card.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { flattenProducts, type FlattenedProduct } from '@/lib/commerce/product-flatten';
import type { AdminProductsSummary } from '@/lib/commerce/admin-products-summary';
import { useListParams } from '../../hooks/useListParams';
import { useListData } from '../../hooks/useListData';
import { useListSummary } from '../../hooks/useListSummary';
import { useAdminRealtime } from '../../hooks/useAdminRealtime';

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export function useStock() {
  const [lowStockThreshold, setLowStockThreshold] = useState(DEFAULT_LOW_STOCK_THRESHOLD);

  const params = useListParams({
    sort: 'stock',
    direction: 'asc',
    filters: {
      stock: 'all',
      category: '',
      lowStockThreshold: String(DEFAULT_LOW_STOCK_THRESHOLD),
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
    setLowStockThreshold,
  };
}
