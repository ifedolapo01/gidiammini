/**
 * COMMERCE layer — the shapes a storefront listing is made of.
 *
 * A leaf: types only, no queries and no cache. Split out of
 * product-listing-query.ts, which had grown past 200 lines, and it is the
 * natural seam — three interfaces describing what a listing page *is*, read by
 * the query layer, the cache layer, the recommendation rails and the route
 * that serves "Load more". Everything that imports these wants nothing else
 * from that module.
 */
import type { Discount } from '@/lib/commerce/discounts';

/** Everything ProductCard draws, and nothing else. */
export interface ListingProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  sub_category: string | null;
  main_image: string;
  stock: number;
  price_min: number;
  price_max: number;
  /** Merged in from product_review_stats — see attachReviewStats. Absent when
   *  the product has no published reviews. */
  rating_average?: number;
  review_count?: number;
  /** The keyset key. Stripped before the response leaves the server. */
  sort_value?: string | null;
}

export interface ListingPage {
  products: ListingProduct[];
  nextCursor: string | null;
  /** Null when the on-sale facet is on — see fetchOnSalePage. */
  total: number | null;
}

export interface ListingShell {
  categories: Array<{ name: string; slug: string; subcategories?: { name: string; slug: string }[] }>;
  discounts: Discount[];
  facets: { sizes: string[]; colors: string[]; minPrice: number; maxPrice: number };
}
