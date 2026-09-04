/**
 * STOREFRONT layer — the wishlist's cards, looked up from its ids.
 *
 * The wishlist stores ids and nothing else (see WishlistProvider), so this is
 * where a saved list becomes something that can be drawn. Every card is
 * current by construction: there is no snapshot to fall out of date, which is
 * the whole reason the stored shape changed.
 *
 * Not a new endpoint: /api/recommendations' 'viewed' type is already "ids in,
 * cards out, uncached" — the same call the recently-viewed rail makes — and
 * those rows carry the star row too.
 *
 * A product that has been delisted comes back as nothing and simply is not
 * drawn. That is a change from the old behaviour, which rendered it from its
 * snapshot: a card for something nobody can buy, at whatever it used to cost,
 * is worse than one fewer card.
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
  /** False until the lookup answers, so an empty list can be told apart from
   *  one that has not arrived. */
  loaded: boolean;
}

export function useWishlistCards(ids: string[]): WishlistCards {
  // The route caps how many ids one request may carry, so a very long wishlist
  // shows its first page. That is the same trade the recently-viewed rail
  // makes, and the cap is what stops this being a way to ask about the whole
  // catalogue in one call.
  const { products, discounts, loading } = useRecommendations({ type: 'viewed', ids });

  const cards = new Map(products.map((product) => [product.id, product]));

  return {
    // The saved order is the customer's, not the server's: they built this
    // list, and it should not reshuffle because a lookup came back in a
    // different order.
    items: ids.map((id) => cards.get(id)).filter((card): card is ProductCardProduct => Boolean(card)),
    discounts,
    loaded: !loading && (ids.length === 0 || products.length > 0),
  };
}
