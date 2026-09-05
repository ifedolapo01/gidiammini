/** ADMIN layer — the catalogue behind "add an item to this order".
 *
 * Reads /api/admin/products/catalog, the lean projection the discounts editor
 * already uses: no images, no descriptions, just what is needed to name a
 * product, pick a variant and know what it costs. Loaded once per mount rather
 * than polled — a catalogue that changed while somebody was mid-edit would
 * move the option under their cursor, and the price is re-read server-side by
 * the pricing rules anyway.
 *
 * Search is client-side because the whole (capped) list is already here and a
 * round trip per keystroke would be slower than filtering it.
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface PickerVariant {
  variant_key: string;
  size: string | null;
  color: string | null;
  price: number | null;
  is_active: boolean;
}

export interface PickerProduct {
  id: string;
  name: string;
  category: string | null;
  price: number;
  product_variants?: PickerVariant[];
}

/** Enough to scan, few enough to render. Anything past this is a search term
 * the operator has not typed yet. */
const MAX_RESULTS = 25;

export function useProductPicker() {
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetch('/api/admin/products/catalog')
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.success) setProducts(data.products ?? []);
        else setError(data?.error || 'Could not load the catalogue.');
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the catalogue.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matched = term
      ? products.filter(
          (product) =>
            product.name.toLowerCase().includes(term) ||
            (product.category ?? '').toLowerCase().includes(term)
        )
      : products;

    return matched.slice(0, MAX_RESULTS);
  }, [products, search]);

  /** Only the variants worth offering. An inactive one cannot be sold, and
   * offering it produces an order line the stock adjustment will refuse. */
  const variantsFor = useCallback(
    (productId: string): PickerVariant[] =>
      (products.find((product) => product.id === productId)?.product_variants ?? []).filter(
        (variant) => variant.is_active
      ),
    [products]
  );

  return {
    products,
    results,
    loading,
    error,
    search,
    setSearch,
    variantsFor,
    truncated: !search.trim() && products.length > MAX_RESULTS,
  };
}
