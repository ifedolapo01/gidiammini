/**
 * COMMERCE layer (server only) — the three recommendation surfaces.
 *
 * Each one is "work out some ids, then look up their cards". The id logic lives
 * in Postgres (related_product_ids, co_purchased_product_ids); the card shape
 * comes from product_cards(), which is also what keeps these rails identical to
 * the listing grid. None of them invents its own column list.
 *
 * Cached under the same `products` tag as the listing, so an admin edit clears
 * the rails along with everything else — a recommendation showing a price the
 * product page disagrees with is worse than no recommendation.
 */
import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { PRODUCTS_CACHE_TAG } from './product-cache';
import { attachReviewStats } from './review-query';
import type { ListingProduct } from './product-listing-query';
import type { Discount } from './discounts';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Rails are a sidebar, not a catalogue. Four to eight is the whole design. */
export const RELATED_LIMIT = 8;
export const CART_CROSS_SELL_LIMIT = 4;

/** Longer than the listing's minute: these change on a nightly rebuild. */
const CACHE_SECONDS = 15 * 60;

/** A recommendation card is a listing card without the keyset key. */
export type RecommendedProduct = Omit<ListingProduct, 'sort_value'>;

/**
 * Ids in, cards out, order preserved.
 *
 * Shared by all three surfaces — the ranking has already been decided by
 * whoever produced the id list, and product_cards() honours it.
 */
async function cardsFor(supabase: SupabaseClient, ids: string[]): Promise<RecommendedProduct[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase.rpc('product_cards', { p_ids: ids });

  if (error) {
    console.error('Product cards lookup failed:', error.message);
    return [];
  }

  // Same star row as the listing grid, from the same helper — a rail and the
  // grid showing different ratings for one product is the kind of detail that
  // makes both look made up.
  return attachReviewStats((data ?? []) as RecommendedProduct[], supabase);
}

async function idsFrom(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>
): Promise<string[]> {
  const { data, error } = await supabase.rpc(fn, args);

  if (error) {
    // A rail that cannot be built is a rail that is not rendered. It must never
    // be the reason a product page or a cart fails.
    console.error(`${fn} failed:`, error.message);
    return [];
  }
  return ((data ?? []) as Array<{ product_id: string }>).map((row) => row.product_id);
}

async function fetchRelated(productId: string): Promise<RecommendedProduct[]> {
  const supabase: SupabaseClient = createAdminClient();
  const ids = await idsFrom(supabase, 'related_product_ids', {
    p_product_id: productId,
    p_limit: RELATED_LIMIT,
  });
  return cardsFor(supabase, ids);
}

async function fetchCoPurchased(productIds: string[]): Promise<RecommendedProduct[]> {
  const supabase: SupabaseClient = createAdminClient();
  const ids = await idsFrom(supabase, 'co_purchased_product_ids', {
    p_product_ids: productIds,
    p_limit: CART_CROSS_SELL_LIMIT,
  });
  return cardsFor(supabase, ids);
}

export function loadRelatedProducts(productId: string): Promise<RecommendedProduct[]> {
  return unstable_cache(() => fetchRelated(productId), ['related-products', productId], {
    tags: [PRODUCTS_CACHE_TAG],
    revalidate: CACHE_SECONDS,
  })();
}

/**
 * Cart cross-sell. Keyed on the sorted cart contents, so two shoppers with the
 * same basket share a cache entry and reordering it does not miss.
 */
export function loadCartRecommendations(productIds: string[]): Promise<RecommendedProduct[]> {
  const key = [...productIds].sort().join(',');

  return unstable_cache(() => fetchCoPurchased(productIds), ['cart-recommendations', key], {
    tags: [PRODUCTS_CACHE_TAG],
    revalidate: CACHE_SECONDS,
  })();
}

/**
 * The active discounts, so a rail prices a product the same way the listing
 * and the product page do.
 *
 * Served with the rail rather than left to each caller: the cart page has no
 * discounts of its own, and without this a discounted product would show its
 * full price in the cross-sell and its sale price everywhere else.
 */
export function loadActiveDiscounts(): Promise<Discount[]> {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data, error } = await supabase.from('discounts').select('*').eq('is_active', true);
      if (error) {
        console.error('Discount load failed:', error.message);
        return [] as Discount[];
      }
      return (data ?? []) as Discount[];
    },
    ['recommendation-discounts'],
    { tags: [PRODUCTS_CACHE_TAG], revalidate: CACHE_SECONDS }
  )();
}

/**
 * Recently viewed — deliberately NOT cached.
 *
 * The id list is one person's browsing history. Caching a response keyed on it
 * would store that history on the server, which is exactly what keeping this in
 * localStorage was meant to avoid. It is one indexed lookup by primary key.
 */
export async function loadProductsByIds(ids: string[]): Promise<RecommendedProduct[]> {
  const supabase: SupabaseClient = createAdminClient();
  return cardsFor(supabase, ids);
}
