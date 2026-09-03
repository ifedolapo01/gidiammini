/**
 * STOREFRONT layer — the wishlist's cards, refreshed against the catalogue.
 *
 * The wishlist stores a *snapshot* of each product in localStorage, taken
 * whenever the heart was tapped. That is the right thing for identity — it is
 * how the list survives with no account — but a snapshot cannot carry a rating
 * that did not exist yet, and weeks later it is also quietly showing an old
 * price and an old stock level.
 *
 * So the ids are sent back to the server for fresh card rows. Not a new
 * endpoint: /api/recommendations' 'viewed' type is already "ids in, cards out,
 * uncached" — the same call the recently-viewed rail makes — and since reviews
 * shipped those rows carry the star row too.
 *
 * The stored snapshot stays the fallback. A product that has been delisted
 * comes back from the server as nothing, and dropping it would leave the page
 * showing fewer items than the wishlist says it holds; it renders from the
 * snapshot instead, as it did before this hook existed.
 */
'use client';

import { useRecommendations } from '@/components/commerce/hooks/useRecommendations';
import type { ProductCardProduct } from '@/types/product';
import type { Discount } from '@/lib/commerce/discounts';

export interface WishlistCards {
  items: ProductCardProduct[];
  /** So a wishlisted product shows the same sale badge the listing gives it —
   *  the page had no discounts of its own to pass down before. */
  discounts: Discount[];
}

export function useWishlistCards(stored: ProductCardProduct[]): WishlistCards {
  const ids = stored.map((item) => item.id);

  // The route caps how many ids one request may carry, so a very long wishlist
  // refreshes its first page and the rest render from their snapshots. That is
  // the same trade the recently-viewed rail makes, and the cap is what stops
  // this being a way to ask about the whole catalogue in one call.
  const { products, discounts } = useRecommendations({ type: 'viewed', ids });

  if (products.length === 0) return { items: stored, discounts };

  const fresh = new Map(products.map((product) => [product.id, product]));

  return {
    // Merged, not replaced: the fresh row wins field by field, and anything it
    // does not know about (a product no longer listed) keeps what was saved.
    items: stored.map((item) => ({ ...item, ...fresh.get(item.id) })),
    discounts,
  };
}
