/** ADMIN layer hook — the most-wishlisted panel's data. */
'use client';

import { useEffect, useState } from 'react';
import type { WishlistDemandEntry } from '@/lib/commerce/wishlist-demand';

/**
 * Its own fetch rather than another field on the dashboard stats call: this is
 * the one panel whose numbers do not come from orders, it is not needed to
 * render the page, and a wishlist query failing must not take the whole
 * dashboard down with it.
 */
export function useWishlistDemand() {
  const [products, setProducts] = useState<WishlistDemandEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/admin/wishlist', { signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.success) setProducts(payload.products ?? []);
        else setError(payload?.error ?? 'Could not load wishlist demand');
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError('Could not load wishlist demand');
        void cause;
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  return { products, loading, error };
}
