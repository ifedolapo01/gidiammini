/**
 * COMMERCE layer (server only) — caching a page of the storefront listing.
 *
 * One module serves both callers, so the server-rendered first page and the
 * "Load more" that follows it cannot disagree about what a page is: the page
 * component calls it directly, and /api/products calls it for every page after
 * the first. The queries themselves live in product-listing-query.ts.
 *
 * Everything here is cached under one tag. Admin writes call
 * revalidateProductListings(), which is why an edited product appears without
 * waiting for the time-based window to lapse. The window is still short,
 * because stock moves without any admin doing anything — every checkout
 * changes it — and a listing that confidently shows a sold-out item as
 * available is worse than one that is a minute stale.
 */
import 'server-only';
import { unstable_cache } from 'next/cache';
import type { ProductFilters } from './product-filters';
import {
  fetchListingPage,
  fetchListingShell,
  type ListingPage,
  type ListingProduct,
  type ListingShell,
} from './product-listing-query';

export type { ListingPage, ListingProduct, ListingShell } from './product-listing-query';

// The tag and its invalidator live in product-cache.ts — a leaf, so a module
// that needs only the tag does not have to import the query layer. Re-exported
// here because this is where every existing caller reaches for them.
export { PRODUCTS_CACHE_TAG, revalidateProductListings } from './product-cache';

import { PRODUCTS_CACHE_TAG } from './product-cache';

/** Short, because checkout moves stock without any admin action. */
const CACHE_SECONDS = 60;

/**
 * The cache key has to name every input by hand: unstable_cache hashes the
 * arguments, and two different filter objects that mean the same thing must
 * land on the same key or the cache never hits.
 */
function cacheKey(filters: ProductFilters, cursor: string | null): string {
  return JSON.stringify([
    filters.category,
    filters.subcategory,
    filters.minPrice,
    filters.maxPrice,
    [...filters.sizes].sort(),
    [...filters.colors].sort(),
    filters.onSale,
    filters.inStockOnly,
    filters.sort,
    cursor,
  ]);
}

export function loadListingPage(filters: ProductFilters, cursor: string | null): Promise<ListingPage> {
  return unstable_cache(
    () => fetchListingPage(filters, cursor),
    ['product-listing-page', cacheKey(filters, cursor)],
    { tags: [PRODUCTS_CACHE_TAG], revalidate: CACHE_SECONDS }
  )();
}

export function loadListingShell(filters: ProductFilters): Promise<ListingShell> {
  return unstable_cache(
    () => fetchListingShell(filters),
    ['product-listing-shell', filters.category, filters.subcategory],
    { tags: [PRODUCTS_CACHE_TAG], revalidate: CACHE_SECONDS }
  )();
}

/** Strips the keyset key, which is the caller's business and not the browser's. */
export function withoutCursorKey(products: ListingProduct[]): ListingProduct[] {
  return products.map(({ sort_value: _sortValue, ...product }) => product);
}
