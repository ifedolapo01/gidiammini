/** ADMIN layer — the data the discounts page reads: the discounts themselves,
 * the categories and products its target dropdown offers, and the background
 * refresh.
 *
 * Split out of useDiscounts.ts, which is now about the form and the modal.
 *
 * The product catalogue is loaded once rather than polled. It is the one
 * surface that genuinely needs every product — the target dropdown lists them
 * all, and findBelowCostVariants() checks a proposed discount against every
 * variant it would touch — so it reads the lean /catalog projection instead of
 * the paged products list, and re-reading that every minute would undo the
 * point of the projection.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Discount } from '@/lib/commerce/discounts';
import type { Category, Product } from '@/types/product';
import { ADMIN_POLL_INTERVAL_MS } from '../../lib/adminPolling';

export function useDiscountData() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true);
    try {
      const [discRes, catRes] = await Promise.all([
        fetch('/api/admin/discounts'),
        fetch('/api/admin/categories'),
      ]);

      const discData = await discRes.json();
      if (discData.success) setDiscounts(discData.discounts);

      const catData = await catRes.json();
      if (catData.success) setCategories(catData.categories);
    } catch (err) {
      if (opts.silent) console.error('Error syncing discounts:', err);
      else setError('Failed to load data');
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetch('/api/admin/products/catalog')
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setProducts(data.products || []);
      })
      .catch((err) => console.error('Failed to load product catalog', err));
  }, []);

  // Background poll — keeps the list fresh without a manual Refresh button.
  useEffect(() => {
    const interval = setInterval(() => fetchData({ silent: true }), ADMIN_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { discounts, categories, products, loading, error, setError, refresh: fetchData };
}
