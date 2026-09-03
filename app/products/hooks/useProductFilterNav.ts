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
  type ProductFilters,
} from '@/lib/commerce/product-filters';

export function useProductFilterNav(filters: ProductFilters) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const updateFilters = useCallback(
    (change: Partial<ProductFilters>) => {
      const href = productFiltersToHref(applyFilterChange(filters, change));
      // scroll: false — re-sorting a grid the shopper is halfway down should
      // not throw them back to the top.
      startTransition(() => router.push(href, { scroll: false }));
    },
    [filters, router]
  );

  const clearFilters = useCallback(() => {
    startTransition(() => router.push('/products', { scroll: false }));
  }, [router]);

  /** Category and subcategory move together, so picking a category drops the
   *  subcategory that belonged to the previous one. */
  const navigateToCategory = useCallback(
    (categorySlug: string, subCategorySlug: string = 'all') => {
      updateFilters({ category: categorySlug, subcategory: subCategorySlug });
    },
    [updateFilters]
  );

  return { pending, updateFilters, clearFilters, navigateToCategory };
}
