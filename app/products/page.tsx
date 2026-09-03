/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// app/products/page.tsx — the collection listing.
//
// A SERVER component. It was a client component that fetched every active
// product with select('*') after hydration, which meant the first thing a
// shopper on mobile data got was an empty grid and a spinner, followed by every
// column of every product — image arrays, detail arrays, the whole
// pricing_config — for a card that draws six fields.
//
// Now the first page is rendered here, from a cached query that selects only
// what the card draws. The filter rail, the sort control and "Load more" are
// the client components below; changing a filter is a navigation, so the server
// renders the new first page rather than the browser refetching it.
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { parseProductFilters, type ProductFilters } from '@/lib/commerce/product-filters';
import { loadListingPage, loadListingShell, withoutCursorKey } from '@/lib/commerce/product-listing';
import ProductsBrowser from './components/ProductsBrowser';
import ProductsListingSkeleton from './components/ProductsListingSkeleton';

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The canonical URL for a filtered view: category and subcategory only.
 *
 * Those two are the facets the sitemap lists and the ones a search actually
 * expresses ("baby bodysuits"), so they get to be their own indexable page.
 * Size, colour, price, sort and the sale toggle multiply into thousands of
 * near-identical URLs, so every combination of them folds back onto the
 * category page rather than competing with it for the same query.
 */
function canonicalListingPath(filters: ProductFilters): string {
  const params = new URLSearchParams();
  if (filters.category !== 'all') params.set('category', filters.category);
  if (filters.subcategory !== 'all') params.set('subcategory', filters.subcategory);

  const query = params.toString();
  return query === '' ? '/products' : `/products?${query}`;
}

export async function generateMetadata({ searchParams }: ProductsPageProps): Promise<Metadata> {
  const filters = parseProductFilters(toSearchParams(await searchParams));
  const shell = await loadListingShell(filters);

  const category = shell.categories.find((entry) => entry.slug === filters.category);
  const subcategory = category?.subcategories?.find((entry) => entry.slug === filters.subcategory);
  const name = subcategory?.name ?? category?.name;

  const title = name ? `${name} — Our Collection` : 'Our Collection';
  const description = name
    ? `Shop ${name} at GidiamMini — filter by size, colour and price.`
    : 'Browse the full GidiamMini collection — filter by category, size, colour and price.';
  const canonical = canonicalListingPath(filters);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
  };
}

/**
 * Next hands searchParams as a plain object with repeated keys collapsed into
 * arrays; parseProductFilters wants URLSearchParams' get/getAll. Rebuilding one
 * is cheaper than teaching the codec a second input shape, and keeps the parse
 * identical to the one /api/products runs.
 */
function toSearchParams(raw: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  return params;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const filters = parseProductFilters(toSearchParams(await searchParams));

  // The queries live in the child, behind Suspense, so the response starts
  // flushing before the database has answered — the visitor gets the layout and
  // the header immediately instead of a blank document.
  //
  // Deliberately un-keyed. A key would swap back to the skeleton on every
  // filter change; ProductsBrowser instead dims the results it already has and
  // keeps them on screen, because they are still true until the new ones land.
  // The skeleton is for the first paint, when there is genuinely nothing.
  return (
    <Suspense fallback={<ProductsListingSkeleton />}>
      <ProductsListing filters={filters} />
    </Suspense>
  );
}

async function ProductsListing({ filters }: { filters: ProductFilters }) {
  // The shell does not depend on the page, and the page does not depend on the
  // shell, so neither waits for the other.
  const [shell, firstPage] = await Promise.all([
    loadListingShell(filters),
    loadListingPage(filters, null),
  ]);

  return (
    <ProductsBrowser
      // Remounts the browser when the filters change, so accumulated "Load
      // more" results from the previous filter set cannot survive into the new
      // one. Without this, narrowing to size 2 would leave the earlier products
      // on screen beneath the new ones.
      key={JSON.stringify(filters)}
      initialProducts={withoutCursorKey(firstPage.products)}
      initialCursor={firstPage.nextCursor}
      total={firstPage.total}
      categories={shell.categories}
      discounts={shell.discounts}
      facets={shell.facets}
      filters={filters}
    />
  );
}
