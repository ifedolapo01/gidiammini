/**
 * COMMERCE layer — the listing's filter and sort state, as it lives in the URL.
 *
 * The URL is the single source of truth for what the shopper is looking at.
 * That is what makes a filtered view shareable ("here, this page, size 2 under
 * ten thousand") and indexable, and it is why none of this state lives in a
 * component. The hook reads the URL; the sidebar writes it; nothing keeps a
 * private copy that can drift.
 *
 * Two rules hold the round trip together:
 *
 *   1. A default is never written to the URL. `/products` and
 *      `/products?sort=newest&stock=in` mean the same thing, so only one of
 *      them should ever exist — otherwise every filtered page has a dozen
 *      spellings and the crawler sees a dozen duplicates.
 *   2. Anything unrecognised falls back to the default rather than throwing.
 *      These values arrive from a pasted link and a stale bookmark is not an
 *      error condition.
 *
 * Pure and dependency-free, so the whole round trip is testable without a
 * router or a browser.
 */

/** Sort orders the listing offers. `value` is what list_products() expects. */
export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'best_selling', label: 'Best selling' },
  { value: 'name', label: 'Name: A to Z' },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]['value'];

const SORT_VALUES: readonly string[] = SORT_OPTIONS.map((option) => option.value);

/** Rows per keyset page — one "Load more" press. */
export const PAGE_SIZE = 24;

export interface ProductFilters {
  /** A category slug, or 'all'. Kept as a string rather than null to match the
   *  existing sidebar contract, which has always compared against 'all'. */
  category: string;
  subcategory: string;
  minPrice: number | null;
  maxPrice: number | null;
  sizes: string[];
  colors: string[];
  /** Applied in the browser via getBestDiscount — see the migration's note. */
  onSale: boolean;
  /**
   * Off by default. Sold-out products are shown, dimmed and ranked last,
   * rather than hidden — hiding them threw away the indexed page, the ranking
   * it had earned, and the clearest restock signal the store gets. Hiding them
   * is now the shopper's choice, not the storefront's.
   */
  inStockOnly: boolean;
  sort: SortValue;
}

export const DEFAULT_FILTERS: ProductFilters = {
  category: 'all',
  subcategory: 'all',
  minPrice: null,
  maxPrice: null,
  sizes: [],
  colors: [],
  onSale: false,
  inStockOnly: false,
  sort: 'newest',
};

/** Anything with URLSearchParams' read half — including Next's readonly one. */
export interface ParamsLike {
  get(name: string): string | null;
  getAll(name: string): string[];
}

function parsePositiveInt(raw: string | null, fallback: number | null): number | null {
  if (raw === null || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.trunc(value);
}

/**
 * Repeated params (`?size=S&size=M`) rather than a comma-joined list, because a
 * colour is free text an admin typed and "Navy, Cream" is a plausible thing to
 * find in it. Blanks and duplicates are dropped so the URL cannot carry the
 * same filter twice.
 */
function parseList(params: ParamsLike, name: string): string[] {
  const seen = new Set<string>();
  for (const raw of params.getAll(name)) {
    const value = raw.trim();
    if (value !== '') seen.add(value);
  }
  return [...seen];
}

export function parseProductFilters(params: ParamsLike | null | undefined): ProductFilters {
  if (!params) return { ...DEFAULT_FILTERS };

  const sortParam = params.get('sort');
  const minPrice = parsePositiveInt(params.get('min'), null);
  const maxPrice = parsePositiveInt(params.get('max'), null);

  // A reversed band is a typo in a hand-edited URL, not a request for nothing.
  const swap = minPrice !== null && maxPrice !== null && minPrice > maxPrice;

  return {
    category: params.get('category')?.trim() || 'all',
    subcategory: params.get('subcategory')?.trim() || 'all',
    minPrice: swap ? maxPrice : minPrice,
    maxPrice: swap ? minPrice : maxPrice,
    sizes: parseList(params, 'size'),
    colors: parseList(params, 'color'),
    onSale: params.get('sale') === '1',
    // Only the explicit opt-in flips it; anything else keeps the default.
    inStockOnly: params.get('stock') === 'in',
    sort: SORT_VALUES.includes(sortParam ?? '') ? (sortParam as SortValue) : 'newest',
  };
}

/**
 * The inverse. Defaults are omitted, so the query string only ever names what
 * the shopper actually chose.
 */
export function productFiltersToQuery(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.category !== 'all') params.set('category', filters.category);
  if (filters.subcategory !== 'all') params.set('subcategory', filters.subcategory);
  if (filters.minPrice !== null) params.set('min', String(filters.minPrice));
  if (filters.maxPrice !== null) params.set('max', String(filters.maxPrice));

  for (const size of filters.sizes) params.append('size', size);
  for (const color of filters.colors) params.append('color', color);

  if (filters.onSale) params.set('sale', '1');
  if (filters.inStockOnly) params.set('stock', 'in');
  if (filters.sort !== 'newest') params.set('sort', filters.sort);

  return params;
}

/** `/products?...`, ready for router.push. */
export function productFiltersToHref(filters: ProductFilters): string {
  const query = productFiltersToQuery(filters).toString();
  return query === '' ? '/products' : `/products?${query}`;
}

/**
 * How many facets are narrowing the list — the number on the mobile "Filters"
 * button. Sort is excluded: it hides nothing, and a badge reading "1" on an
 * untouched page would be a lie.
 */
export function countActiveFilters(filters: ProductFilters): number {
  return (
    (filters.category !== 'all' ? 1 : 0) +
    (filters.subcategory !== 'all' ? 1 : 0) +
    (filters.minPrice !== null || filters.maxPrice !== null ? 1 : 0) +
    filters.sizes.length +
    filters.colors.length +
    (filters.onSale ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0)
  );
}

/**
 * Applies one facet change.
 *
 * There is no page to reset: paging is a keyset cursor held by the browser for
 * the current filter set, and changing a filter navigates, which discards it.
 * That is the whole reason the cursor is not in the URL — a URL carrying both
 * "size 2" and "start from row 400" is a link that cannot be shared honestly.
 */
export function applyFilterChange(
  filters: ProductFilters,
  change: Partial<ProductFilters>
): ProductFilters {
  return { ...filters, ...change };
}

/** Add or remove one value from a multi-select facet. */
export function toggleFacetValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}
