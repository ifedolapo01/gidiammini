/**
 * COMMERCE layer (server only) — the storefront's cache tag, and dropping it.
 *
 * A leaf module by design. Everything product-shaped that Next caches —
 * listings, one product's detail, the recommendation rails, review
 * aggregates — is tagged with the same string, and every admin write drops it.
 * Keeping that string in product-listing.ts meant anything needing the tag had
 * to import the module that pulls in the whole listing query layer, which is
 * how review-query.ts and product-listing-query.ts ended up importing each
 * other in a circle.
 *
 * Re-exported from product-listing.ts, so existing importers are unaffected.
 */
import 'server-only';
import { revalidateTag } from 'next/cache';

export const PRODUCTS_CACHE_TAG = 'products';

/**
 * Called by every admin route that changes what the storefront shows — via
 * withAdminAuth, which does it after any successful mutating request rather
 * than leaving each route to remember. Without it an edited price sits behind
 * the cache for up to its revalidate window, which is the kind of thing that
 * reads as "the save did not work".
 */
export function revalidateProductListings(): void {
  // Next 16 wants a cache-life profile beside the tag. 'max' says "drop it
  // however long it was meant to live" — the listing is stale the moment an
  // admin changes a product, whatever the time window said.
  revalidateTag(PRODUCTS_CACHE_TAG, 'max');
}
