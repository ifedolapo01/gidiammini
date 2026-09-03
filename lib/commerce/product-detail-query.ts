/**
 * COMMERCE layer (server only) — everything one product page needs, in one read.
 *
 * The page used to fetch this from the browser: `use client`, an effect, two
 * round trips after hydration, and markup that contained no product at all
 * until they landed. This runs on the server instead, before the response is
 * sent, which is what lets generateMetadata describe the actual product.
 *
 * Wrapped in React's `cache` because Next calls generateMetadata and the page
 * component separately for the same request, and both want the same product.
 * `cache` de-duplicates them into one query per request; `unstable_cache` then
 * keeps that result across requests, tagged so an admin edit drops it.
 *
 * The cache window matches the listing's, and for the same reason: checkout
 * moves stock without an admin touching anything, and a page confidently
 * offering a sold-out product is worse than a page a minute stale.
 */
import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public-server';
import { PUBLIC_VARIANTS_SELECT } from './product-variants';
import { PRODUCTS_CACHE_TAG } from './product-listing';
import type { Discount } from './discounts';
import type { Product } from '@/types/product';

const CACHE_SECONDS = 60;

export interface ProductDetail {
  product: Product;
  discounts: Discount[];
  /** The category's display name, for the breadcrumb. Null when the product's
   *  category slug has no matching row — a stale slug should not break a page. */
  categoryName: string | null;
  /** categories.size_guidance, shown at the top of the size guide. From the
   *  same row as the name, so it costs no extra query. */
  categorySizeGuidance: string | null;
}

/** Postgres rejects a non-UUID literal against a uuid column with an error
 *  rather than an empty result, so a junk id from a crawler is filtered here
 *  and answered as "no such product" instead of a 500. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchProductDetail(id: string): Promise<ProductDetail | null> {
  const supabase = createPublicClient();

  const { data: product, error } = await supabase
    .from('products')
    .select(`*,${PUBLIC_VARIANTS_SELECT}`)
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching product detail:', error);
    return null;
  }
  if (!product) return null;

  const typed = product as unknown as Product;

  // Neither of these blocks the other, and neither blocks on the product being
  // parsed — but both need its category, so they start once it has landed.
  const [discountsResult, categoryResult] = await Promise.all([
    supabase.from('discounts').select('*').eq('is_active', true),
    typed.category
      // `*` rather than the two columns this needs, deliberately. Naming
      // size_guidance makes the whole query fail on any database that has not
      // had migration 003500 applied — a fresh staging project, a rollback, or
      // the window between a deploy and a db push — and the failure costs the
      // breadcrumb its category name, silently. One narrow row is cheaper than
      // that coupling.
      ? supabase.from('categories').select('*').eq('slug', typed.category).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    product: typed,
    discounts: (discountsResult.data ?? []) as unknown as Discount[],
    categoryName: (categoryResult.data as { name: string } | null)?.name ?? null,
    categorySizeGuidance:
      (categoryResult.data as { size_guidance?: string | null } | null)?.size_guidance ?? null,
  };
}

/**
 * One product page's data. Returns null for an unknown, inactive or malformed
 * id — the caller turns that into a 404, which is the status a crawler needs
 * to drop the URL from its index.
 */
export const loadProductDetail = cache(async (id: string): Promise<ProductDetail | null> => {
  if (!UUID.test(id)) return null;

  return unstable_cache(() => fetchProductDetail(id), ['product-detail', id], {
    tags: [PRODUCTS_CACHE_TAG],
    revalidate: CACHE_SECONDS,
  })();
});

/** Every indexable product, for the sitemap. Deliberately not the full row —
 *  a sitemap needs a URL and a timestamp and nothing else. */
export async function loadSitemapProducts(): Promise<
  Array<{ id: string; updated_at: string | null }>
> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('products')
    .select('id,updated_at')
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching sitemap products:', error);
    return [];
  }

  return data ?? [];
}

/** Category and subcategory slugs, for the sitemap's filtered listing URLs. */
export async function loadSitemapCategories(): Promise<
  Array<{ slug: string; subcategories: string[] }>
> {
  const supabase = createPublicClient();
  const [categories, subcategories] = await Promise.all([
    supabase.from('categories').select('slug'),
    supabase.from('subcategories').select('slug,category_slug'),
  ]);

  if (categories.error) {
    console.error('Error fetching sitemap categories:', categories.error);
    return [];
  }

  const children = new Map<string, string[]>();
  for (const row of subcategories.data ?? []) {
    const list = children.get(row.category_slug) ?? [];
    list.push(row.slug);
    children.set(row.category_slug, list);
  }

  return (categories.data ?? []).map((category) => ({
    slug: category.slug,
    subcategories: children.get(category.slug) ?? [],
  }));
}
