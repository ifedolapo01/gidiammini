/**
 * COMMERCE layer — fetching one recommendation rail.
 *
 * Client-side and deliberately so. These rails are below the fold on every
 * surface that shows them, and none of them is the reason someone opened the
 * page — blocking the product page's server render on a suggestion rail would
 * trade the thing people came for against decoration.
 *
 * Failure is silence. `products` stays empty, ProductRail renders nothing, and
 * nobody sees an error where a suggestion would have been.
 */
'use client';

import { useEffect, useState } from 'react';
import type { ProductCardProduct } from '@/types/product';
import type { Discount } from '@/lib/commerce/discounts';

export type RecommendationType = 'related' | 'cart' | 'viewed';

interface UseRecommendationsArgs {
  type: RecommendationType;
  /** For 'related'. */
  productId?: string | null;
  /** For 'cart' and 'viewed'. */
  ids?: string[];
}

export function useRecommendations({ type, productId, ids }: UseRecommendationsArgs) {
  const [products, setProducts] = useState<ProductCardProduct[]>([]);
  // Served alongside the products so a rail prices them the way the rest of the
  // site does; the cart page has no discounts of its own to pass down.
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(false);

  // Joined into a string so the effect keys on the contents rather than the
  // array identity — otherwise a parent re-render refetches every rail.
  const idKey = (ids ?? []).join(',');

  useEffect(() => {
    if (type === 'related' && !productId) return;
    if (type !== 'related' && idKey === '') return;

    const controller = new AbortController();
    setLoading(true);

    const query =
      type === 'related'
        ? `type=related&productId=${encodeURIComponent(productId ?? '')}`
        : `type=${type}&ids=${encodeURIComponent(idKey)}`;

    fetch(`/api/recommendations?${query}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        setProducts((payload.products ?? []) as ProductCardProduct[]);
        setDiscounts((payload.discounts ?? []) as Discount[]);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) console.error('Recommendations fetch failed:', cause);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [type, productId, idKey]);

  return { products, discounts, loading };
}
