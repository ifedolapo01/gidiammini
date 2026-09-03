/**
 * COMMERCE layer (server only) — the listing's database reads.
 *
 * Split from product-listing.ts, which is now purely the cache and
 * invalidation wrapper around these. The two answer different questions —
 * "what does the database return for these facets" and "how long may that be
 * reused" — and keeping them apart means the caching policy can change without
 * anyone reading a query, and vice versa.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { getBestDiscount, type Discount } from '@/lib/commerce/discounts';
import { PAGE_SIZE, type ProductFilters } from './product-filters';
import { cursorParams, decodeCursor, encodeCursor, nextCursorFrom } from './product-cursor';
import { attachReviewStats } from './review-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ListingPage, ListingProduct, ListingShell } from './product-listing-types';

// Re-exported so the query layer stays the one import a caller needs, as it
// was before the types moved to their own leaf module.
export type { ListingPage, ListingProduct, ListingShell } from './product-listing-types';

/**
 * How many keyset pages the on-sale facet may walk to fill one page of
 * results. Bounded so a catalogue with two discounted products cannot turn one
 * request into a full table scan.
 */
const MAX_SALE_ROUNDS = 5;

function facetArgs(filters: ProductFilters) {
  return {
    // 'all' is the sidebar's word for "no filter"; the function's word is NULL.
    p_category: filters.category === 'all' ? null : filters.category,
    p_subcategory: filters.subcategory === 'all' ? null : filters.subcategory,
    p_min_price: filters.minPrice,
    p_max_price: filters.maxPrice,
    p_sizes: filters.sizes.length > 0 ? filters.sizes : null,
    p_colors: filters.colors.length > 0 ? filters.colors : null,
    p_in_stock_only: filters.inStockOnly,
  };
}

/** One keyset page, straight from the database. */
async function fetchRawPage(
  supabase: SupabaseClient,
  filters: ProductFilters,
  rawCursor: string | null
): Promise<{ rows: ListingProduct[]; nextCursor: string | null }> {
  const { data, error } = await supabase.rpc('list_products', {
    ...facetArgs(filters),
    p_sort: filters.sort,
    p_limit: PAGE_SIZE,
    ...cursorParams(filters.sort, decodeCursor(rawCursor)),
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ListingProduct[];
  return { rows, nextCursor: nextCursorFrom(rows, PAGE_SIZE) };
}

/**
 * The on-sale facet, which cannot be a WHERE clause.
 *
 * getBestDiscount() decides this — scope precedence, date windows, variant
 * targets — and a PL/pgSQL twin of it would drift. So the walk happens here:
 * fetch a keyset page, keep the discounted rows, and go again if that did not
 * fill a page. Filtering after the database had already paged would hand back
 * short pages; walking keeps every page full until the catalogue runs out.
 */
async function fetchOnSalePage(
  supabase: SupabaseClient,
  filters: ProductFilters,
  discounts: Discount[],
  rawCursor: string | null
): Promise<ListingPage> {
  const kept: ListingProduct[] = [];
  let cursor = rawCursor;
  let exhausted = false;

  for (let round = 0; round < MAX_SALE_ROUNDS && kept.length < PAGE_SIZE; round++) {
    const { rows, nextCursor } = await fetchRawPage(supabase, filters, cursor);
    kept.push(...rows.filter((product) => getBestDiscount(product, discounts) !== null));

    cursor = nextCursor;
    if (!nextCursor) {
      exhausted = true;
      break;
    }
  }

  const products = kept.slice(0, PAGE_SIZE);

  // When the walk overshot, resume from the last row actually returned rather
  // than from where the scan stopped — otherwise the surplus is skipped.
  const overshot = kept.length > PAGE_SIZE;
  const last = products[products.length - 1];
  const nextCursor = overshot
    ? last && typeof last.sort_value === 'string'
      ? encodeCursor({ soldOut: last.stock <= 0, value: last.sort_value, id: last.id })
      : null
    : exhausted
      ? null
      : cursor;

  // No total: counting discounted products means applying getBestDiscount to
  // the whole catalogue, and the UI would rather say nothing than guess.
  return { products, nextCursor, total: null };
}

/** One page, plus the count the first request needs. */
async function fetchPlainPage(
  supabase: SupabaseClient,
  filters: ProductFilters,
  rawCursor: string | null
): Promise<ListingPage> {
  const [{ rows, nextCursor }, total] = await Promise.all([
    fetchRawPage(supabase, filters, rawCursor),
    // Only the first page pays for a count; every "Load more" after it already
    // knows the total and asks for rows alone.
    rawCursor ? Promise.resolve(null) : countProducts(supabase, filters),
  ]);

  return { products: rows, nextCursor, total };
}

export async function fetchListingPage(filters: ProductFilters, rawCursor: string | null): Promise<ListingPage> {
  const supabase: SupabaseClient = createAdminClient();
  let page: ListingPage;

  if (filters.onSale) {
    const { data } = await supabase.from('discounts').select('*').eq('is_active', true);
    page = await fetchOnSalePage(supabase, filters, (data ?? []) as Discount[], rawCursor);
  } else {
    page = await fetchPlainPage(supabase, filters, rawCursor);
  }

  // The star row on each card, in one indexed read over the ids this page
  // returned. Deliberately not part of list_products(): four surfaces share
  // that projection, and widening its return type means re-emitting a
  // 150-line SQL function every time a card grows a field.
  return { ...page, products: await attachReviewStats(page.products, supabase) };
}

async function countProducts(supabase: SupabaseClient, filters: ProductFilters): Promise<number | null> {
  const { data, error } = await supabase.rpc('count_products', facetArgs(filters));
  if (error) {
    console.error('Product count failed:', error.message);
    return null;
  }
  return Number(data ?? 0);
}

export async function fetchListingShell(filters: ProductFilters): Promise<ListingShell> {
  // Typed loosely on purpose, and consistently with the helpers above: the
  // functions this module calls are defined by migrations 002900/003000, and
  // types/database.ts only learns their signatures when `npm run db:types` is
  // rerun against a database that has them.
  const supabase: SupabaseClient = createAdminClient();

  const [categoriesRes, discountsRes, facetsRes] = await Promise.all([
    supabase.from('categories').select('name, slug, subcategories(name, slug)').order('name'),
    supabase.from('discounts').select('*').eq('is_active', true),
    supabase.rpc('product_facet_options', {
      p_category: filters.category === 'all' ? null : filters.category,
      p_subcategory: filters.subcategory === 'all' ? null : filters.subcategory,
    }),
  ]);

  return {
    categories: categoriesRes.data ?? [],
    discounts: (discountsRes.data ?? []) as Discount[],
    // A missing facet list costs the shopper the size and colour panels, not
    // the products.
    facets: (facetsRes.data as ListingShell['facets']) ?? {
      sizes: [],
      colors: [],
      minPrice: 0,
      maxPrice: 0,
    },
  };
}
