/**
 * COMMERCE layer (server only) — the category list, for navigation.
 *
 * Just labels and slugs. fetchListingShell already returns categories, but it
 * fetches them alongside every active discount and the full facet histogram,
 * which is the right shape for the listing page and far too much for a link
 * list. This is the cheap read for anything that only needs somewhere to send
 * someone — the 404 page first among them.
 *
 * Cached under the same tag as the listing, so an admin adding a category sees
 * it appear here too rather than waiting out a separate window.
 *
 * The root layout reads this once per request and hands it to the header, the
 * footer and (through CategoryProvider) the product cards, which is what makes
 * adding a category in the admin actually change the site.
 */
import 'server-only';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public-server';
import { PRODUCTS_CACHE_TAG } from './product-listing';
import { categoryLabel, type CategoryNavItem } from './storefront-nav';

export type { CategoryNavItem };

/** An hour. Categories are edited about as often as the shop is renamed, and a
 *  stale link here costs a redirect to a listing that shows everything. */
const CACHE_SECONDS = 3600;

async function fetchCategoryNav(): Promise<CategoryNavItem[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('categories')
    .select('name, slug, display_name')
    .order('name');

  if (!error) {
    // The label is resolved here rather than at each of the four places that
    // render one, so no consumer has to know that display_name falls back to
    // name.
    return (data ?? []).map((category) => ({
      name: category.name,
      slug: category.slug,
      label: categoryLabel(category),
    }));
  }

  // Retried without display_name, for the window between deploying this code
  // and applying 20260904120000_category_display_name.sql. The column is only
  // ever an override for `name`, so losing it costs one label — while losing
  // the read costs every category link in the header and the footer, on every
  // page. Not worth a blank navigation.
  console.error('Error fetching category nav, retrying without display_name:', error);

  const fallback = await supabase.from('categories').select('name, slug').order('name');

  if (fallback.error) {
    // A 404 page that cannot reach the database still has to render, and so
    // does the header on every other page. Returning an empty list drops the
    // category links and keeps Home, All Products, the search box and the
    // links to the full collection — the part that always works.
    console.error('Error fetching category nav:', fallback.error);
    return [];
  }

  return (fallback.data ?? []).map((category) => ({
    name: category.name,
    slug: category.slug,
    label: category.name,
  }));
}

export const loadCategoryNav = unstable_cache(fetchCategoryNav, ['category-nav'], {
  tags: [PRODUCTS_CACHE_TAG],
  revalidate: CACHE_SECONDS,
});
