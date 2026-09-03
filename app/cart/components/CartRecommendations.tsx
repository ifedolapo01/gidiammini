/**
 * STOREFRONT layer — "Customers also bought", on the cart page.
 *
 * This is the surface the whole exercise is for. Delivery is charged per order,
 * so a second item costs the customer nothing extra to ship and earns the store
 * a second margin on the same delivery — the one place where "buy another
 * thing" is genuinely in both parties' interest, which is why the subtitle says
 * so rather than just nudging.
 *
 * Suggestions come from real co-purchases (product_pairs, rebuilt nightly), not
 * from category. On the cart page a guess is worse than nothing: it is a
 * distraction placed directly in front of the checkout button.
 */
'use client';

import ProductRail from '@/components/commerce/ProductRail';
import { useRecommendations } from '@/components/commerce/hooks/useRecommendations';

interface CartRecommendationsProps {
  /** Product ids currently in the cart. */
  productIds: string[];
}

export default function CartRecommendations({ productIds }: CartRecommendationsProps) {
  const { products, discounts } = useRecommendations({ type: 'cart', ids: productIds });

  return (
    <ProductRail
      title="Customers also bought"
      subtitle="Delivery is charged per order — adding to this one costs nothing more to ship."
      products={products}
      discounts={discounts}
    />
  );
}
