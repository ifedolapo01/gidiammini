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

export interface HeroSlide {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  buttonText: string;
  link: string;
}

/**
 * The curated grid, falling back to recent stock when nothing is curated yet.
 *
 * A fresh install (or a shop that has never touched the "Feature" bulk
 * action) has no is_featured rows at all — showing an empty grid in that case
 * would be a regression on the demo's previous "just show the newest four"
 * behaviour. The fallback only fires when the featured query comes back
 * empty, so once an admin features anything, that curation wins outright.
 */
async function fetchFeaturedProductRows(supabase: ReturnType<typeof createPublicClient>) {
  const featured = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .eq('is_featured', true)
    .gt('stock', 0)
    .order('featured_rank', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(FEATURED_COUNT);

  if (featured.error) return featured;
  if ((featured.data?.length ?? 0) > 0) return featured;

  return supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .gt('stock', 0)
    .order('created_at', { ascending: false })
    .limit(FEATURED_COUNT);
}

async function fetchFeatured(): Promise<FeaturedProducts> {
  const supabase = createPublicClient();

  // In parallel: the discounts do not depend on the products.
  const [productsResult, discountsResult] = await Promise.all([
    fetchFeaturedProductRows(supabase),
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

async function fetchHeroSlides(): Promise<HeroSlide[]> {
  const supabase = createPublicClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('homepage_slides')
    .select('id, image_path, title, subtitle, cta_label, cta_link')
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order('sort_order', { ascending: true });

  if (error) {
    // The hero has a built-in default carousel for exactly this case — see
    // HeroCarousel.tsx — so an empty array here is a graceful fallback, not a
    // broken page.
    console.error('Error fetching homepage slides:', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    image: row.image_path,
    title: row.title,
    subtitle: row.subtitle,
    buttonText: row.cta_label,
    link: row.cta_link,
  }));
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

/**
 * Tagged with the same PRODUCTS_CACHE_TAG as everything else on this page,
 * not a tag of its own: withAdminAuth already drops that tag after every
 * successful admin mutation (see lib/api/with-admin-auth.ts), including a
 * write to homepage_slides, so a dedicated tag would need its own
 * invalidation call for no benefit.
 */
export function loadHeroSlides(): Promise<HeroSlide[]> {
  return unstable_cache(fetchHeroSlides, ['home-hero-slides'], {
    tags: [PRODUCTS_CACHE_TAG],
    revalidate: PRODUCT_CACHE_SECONDS,
  })();
}
