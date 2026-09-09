/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// app/search/page.tsx — the full results page behind the header typeahead.
//
// A SERVER component, same shape as /products/page.tsx: parse the filters,
// load a page through the exact same loadListingPage/loadListingShell pair,
// and hand them to the same ProductsBrowser. A search is just another
// predicate on the listing now (see list_products()'s p_search), so this page
// inherits the facet rail, the sort control and "Load more" rather than
// running a second, parallel implementation of all three.
import { Suspense } from 'react';
import type { Metadata } from 'next';
import {
  parseProductFilters,
  searchParamsFromNext,
  countActiveFilters,
  type ProductFilters,
} from '@/lib/commerce/product-filters';
import { loadListingPage, loadListingShell, withoutCursorKey } from '@/lib/commerce/product-listing';
import { loadSearchFallback } from '@/lib/commerce/search-fallback';
import { logSearchQuery } from '@/lib/commerce/search-log';
import { isSearchable, MIN_QUERY_LENGTH } from '@/lib/commerce/search-query';
import { createAdminClient } from '@/lib/supabase/admin-server';
import ProductsBrowser from '../products/components/ProductsBrowser';
import ProductsListingSkeleton from '../products/components/ProductsListingSkeleton';
import SearchEmptyState from './components/SearchEmptyState';

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const filters = parseProductFilters(searchParamsFromNext(await searchParams));
  const title = filters.query ? `Search results for “${filters.query}”` : 'Search';

  return {
    title,
    // Not the canonical spelling of anything — unlike /products' category
    // URLs, a query string is not a page worth a crawler ranking.
    robots: { index: false },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const filters = parseProductFilters(searchParamsFromNext(await searchParams));

  return (
    <Suspense fallback={<ProductsListingSkeleton />}>
      <SearchListing filters={filters} />
    </Suspense>
  );
}

async function SearchListing({ filters }: { filters: ProductFilters }) {
  if (!isSearchable(filters.query)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-h3 font-extrabold tracking-tight text-text-primary">Search</h1>
        <p className="mt-2 text-body-sm text-text-secondary">
          Type at least {MIN_QUERY_LENGTH} characters in the search box above.
        </p>
      </div>
    );
  }

  // The shell does not depend on the page, and the page does not depend on the
  // shell, so neither waits for the other — same split as /products.
  const [shell, firstPage] = await Promise.all([
    loadListingShell(filters),
    loadListingPage(filters, null),
  ]);

  // Same demand-signal log the typeahead writes on every keystroke pause —
  // this is the entry for whoever landed here directly (a shared link, a
  // bookmark, the back button) rather than by typing through the dropdown.
  // Best-effort: logSearchQuery swallows its own error.
  await logSearchQuery(createAdminClient(), filters.query, firstPage.total ?? firstPage.products.length);

  // Only a genuine zero-result search gets the did-you-mean treatment. A real
  // search narrowed to zero by a facet gets ProductsGrid's ordinary "clear a
  // filter" message instead — that case already has results to go back to.
  const noResultsContent =
    firstPage.products.length === 0 && countActiveFilters(filters) === 0
      ? <SearchEmptyState query={filters.query} fallback={await loadSearchFallback(filters.query)} />
      : undefined;

  return (
    <ProductsBrowser
      // Remounts when the filters change, same reason as /products: "Load
      // more" results from a previous query or facet set must not survive
      // into the new one.
      key={JSON.stringify(filters)}
      basePath="/search"
      heading={`Results for “${filters.query}”`}
      initialProducts={withoutCursorKey(firstPage.products)}
      initialCursor={firstPage.nextCursor}
      total={firstPage.total}
      categories={shell.categories}
      discounts={shell.discounts}
      facets={shell.facets}
      filters={filters}
      noResultsContent={noResultsContent}
    />
  );
}
