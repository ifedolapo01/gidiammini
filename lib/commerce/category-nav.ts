/**
 * COMMERCE layer (server only) — the category list, for navigation.
 *
 * Just names and slugs. fetchListingShell already returns categories, but it
 * fetches them alongside every active discount and the full facet histogram,
 * which is the right shape for the listing page and far too much for a link
 * list. This is the cheap read for anything that only needs somewhere to send
 * someone — the 404 page first among them.
 *
 * Cached under the same tag as the listing, so an admin adding a category sees
 * it appear here too rather than waiting out a separate window.
 */
import 'server-only';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public-server';
import { PRODUCTS_CACHE_TAG } from './product-listing';

export interface CategoryNavItem {
  name: string;
  slug: string;
}

/** An hour. Categories are edited about as often as the shop is renamed, and a
 *  stale link here costs a redirect to a listing that shows everything. */
const CACHE_SECONDS = 3600;

async function fetchCategoryNav(): Promise<CategoryNavItem[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from('categories').select('name, slug').order('name');

  if (error) {
    // A 404 page that cannot reach the database still has to render. Returning
    // an empty list drops the suggestions and keeps the search box and the
    // links to the full collection, which is the part that always works.
    console.error('Error fetching category nav:', error);
    return [];
  }

  return data ?? [];
}

export const loadCategoryNav = unstable_cache(fetchCategoryNav, ['category-nav'], {
  tags: [PRODUCTS_CACHE_TAG],
  revalidate: CACHE_SECONDS,
});
