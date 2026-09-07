/**
 * COMMERCE layer (server only) — the two reads behind the home page.
 *
 * The home page is the highest-traffic route on the site and was the only
 * storefront route reading the database on every single visit. Not because it
 * lacked a cache call, but because it could not be cached at all: it used
 * lib/supabase/server, which reads cookies(), and a component that touches
 * request state opts itself out of every cache Next has. So the featured grid,
 * its discounts and the category tiles were three round trips per visitor.
 *
 * These go through createPublicClient() instead — the anon key with no cookies
 * — which is what makes the results cacheable, and reads exactly what an
 * anonymous visitor is allowed to read anyway.
 *
 * Both are cached under the listing's `products` tag, so an admin editing a
 * product, a price or a category drops them with no invalidation call of its
 * own to forget: withAdminAuth already revalidates that tag after every
 * successful admin mutation.
 */
import 'server-only';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public-server';
import { PRODUCTS_CACHE_TAG } from './product-cache';
import { attachReviewStats } from './review-query';
import { asDiscount } from './db-narrowing';
import type { Discount } from './discounts';
import type { ProductCardProduct } from '@/types/product';

/** Matches the listing's window, and for the same reason: checkout moves stock
 *  without any admin action, and a front page confidently showing a sold-out
 *  item is worse than one a minute stale. */
const PRODUCT_CACHE_SECONDS = 60;

/** Categories are edited about as often as the shop is renamed. Matches
 *  category-nav.ts, which caches the same table for the header. */
const CATEGORY_CACHE_SECONDS = 3600;

/** How many cards the featured grid renders. */
const FEATURED_COUNT = 4;

export interface FeaturedProducts {
  products: Array<ProductCardProduct & { rating_average?: number; review_count?: number }>;
  discounts: Discount[];
}

export interface HomeCategory {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  subcategories: { name: string }[];
}

async function fetchFeatured(): Promise<FeaturedProducts> {
  const supabase = createPublicClient();

  // In parallel: the discounts do not depend on the products.
  const [productsResult, discountsResult] = await Promise.all([
    supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(FEATURED_COUNT),
    supabase.from('discounts').select('*').eq('is_active', true),
  ]);

  if (productsResult.error) {
    // An empty grid is recoverable — the hero, the categories and the whole
    // header still render. Throwing here would take the page down with it.
    console.error('Error fetching featured products:', productsResult.error);
    return { products: [], discounts: [] };
  }

  // Stars on the front door, from the same helper the listing and the rails
  // use. This query is the shop's own — it does not go through list_products()
  // — so without this the highest-traffic cards on the site would be the only
  // ones with no social proof on them.
  const products = await attachReviewStats((productsResult.data ?? []) as ProductCardProduct[]);

  return { products, discounts: (discountsResult.data ?? []).map(asDiscount) };
}

async function fetchCategories(): Promise<HomeCategory[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, color, subcategories(name)')
    .order('created_at', { ascending: true });

  if (error) {
    // Same trade as the header's category nav: losing the tiles costs one
    // section, and the rest of the page is unaffected.
    console.error('Error fetching home categories:', error);
    return [];
  }

  return (data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    color: category.color ?? null,
    subcategories: category.subcategories ?? [],
  }));
}

export function loadFeaturedProducts(): Promise<FeaturedProducts> {
  return unstable_cache(fetchFeatured, ['home-featured'], {
    tags: [PRODUCTS_CACHE_TAG],
    revalidate: PRODUCT_CACHE_SECONDS,
  })();
}

export function loadHomeCategories(): Promise<HomeCategory[]> {
  return unstable_cache(fetchCategories, ['home-categories'], {
    tags: [PRODUCTS_CACHE_TAG],
    revalidate: CATEGORY_CACHE_SECONDS,
  })();
}
