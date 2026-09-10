/**
 * STOREFRONT layer — writing filter changes into the URL.
 *
 * The listing is server-rendered, so a filter change is a navigation and the
 * new results are rendered before the browser sees them. That is faster and
 * cheaper than refetching, but it has one cost: between the click and the new
 * markup there is no spinner, because React is still showing the old page.
 * useTransition is what surfaces that gap — `pending` dims the grid so a tap on
 * a slow connection does not read as "nothing happened".
 */
import { useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  applyFilterChange,
  productFiltersToHref,
  DEFAULT_FILTERS,
  type ProductFilters,
} from '@/lib/commerce/product-filters';

/**
 * `basePath` lets /search reuse this unchanged: a facet change there should
 * stay on /search (keeping `q`), not jump over to the plain category listing.
 */
export function useProductFilterNav(filters: ProductFilters, basePath: string = '/products') {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const updateFilters = useCallback(
    (change: Partial<ProductFilters>) => {
      const href = productFiltersToHref(applyFilterChange(filters, change), basePath);
      // scroll: false — re-sorting a grid the shopper is halfway down should
      // not throw them back to the top.
      startTransition(() => router.push(href, { scroll: false }));
    },
    [filters, router, basePath]
  );

  const clearFilters = useCallback(() => {
    // Resets every facet but keeps the search term: on /products that term is
    // always '' anyway, so this is identical to the old hardcoded '/products'.
    // On /search, "clear filters" narrowing the search should not also throw
    // away the search itself.
    const href = productFiltersToHref({ ...DEFAULT_FILTERS, query: filters.query }, basePath);
    startTransition(() => router.push(href, { scroll: false }));
  }, [filters.query, router, basePath]);

  /** Category, subcategory and sub-subcategory move together, so picking a
   *  category drops the subcategory (and sub-subcategory) that belonged to
   *  the previous one, and picking a subcategory drops its sub-subcategory. */
  const navigateToCategory = useCallback(
    (categorySlug: string, subCategorySlug: string = 'all', subSubCategorySlug: string = 'all') => {
      updateFilters({ category: categorySlug, subcategory: subCategorySlug, subsubcategory: subSubCategorySlug });
    },
    [updateFilters]
  );

  return { pending, updateFilters, clearFilters, navigateToCategory };
}
