/**
 * STOREFRONT layer — the two rails under a product page.
 *
 * Also the one place a product view is recorded. It happens here rather than in
 * the page because it is the same concern as the rail that reads it back, and
 * because an effect keyed on the product id is exactly what "this person looked
 * at this" means — one record per product per visit, not one per render.
 *
 * The history read for the rail is taken from what recordProductView returns
 * rather than re-read from storage, so the current product is already at the
 * front and there is no second trip to localStorage.
 */
'use client';

import { useEffect, useState } from 'react';
import ProductRail from '@/components/commerce/ProductRail';
import { useRecommendations } from '@/components/commerce/hooks/useRecommendations';
import {
  browserStorage,
  recordProductView,
  recentlyViewedExcluding,
} from '@/lib/commerce/recently-viewed';

interface ProductRecommendationsProps {
  productId: string;
}

export default function ProductRecommendations({ productId }: ProductRecommendationsProps) {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    // Recording and reading are the same call: it returns the updated list.
    setHistory(recordProductView(browserStorage(), productId));
  }, [productId]);

  const related = useRecommendations({ type: 'related', productId });
  // Excluding the product being viewed — the one suggestion guaranteed to be
  // useless is the page you are already on.
  const viewed = useRecommendations({
    type: 'viewed',
    ids: recentlyViewedExcluding(history, productId),
  });

  return (
    <>
      <ProductRail
        title="You might also like"
        subtitle="More from this collection"
        products={related.products}
        discounts={related.discounts}
      />
      <ProductRail
        title="Recently viewed"
        products={viewed.products}
        discounts={viewed.discounts}
      />
    </>
  );
}
