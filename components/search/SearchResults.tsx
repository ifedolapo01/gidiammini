/**
 * STOREFRONT layer — the search results page body.
 *
 * Reuses ProductCard so a result looks exactly like the same product on a
 * category page — a search result that renders differently from a browse result
 * reads as a different, lesser part of the site.
 *
 * The query lives in the URL, so a result set is shareable and survives a
 * refresh or a back button.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Spinner } from '@/components/ui';
import ProductCard from '@/components/commerce/ProductCard';
import type { Discount } from '@/lib/commerce/discounts';
import { MIN_QUERY_LENGTH, isSearchable } from '@/lib/commerce/search-query';
import { useProductSearch } from './hooks/useProductSearch';

/** A page's worth, rather than the typeahead's handful. */
const PAGE_LIMIT = 50;

export default function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams?.get('q') ?? '';

  const { products, categories, loading, error, resultsFor } = useProductSearch(query, PAGE_LIMIT);

  // Discounts are fetched separately so a result shows the same struck-through
  // price the storefront shows everywhere else.
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  useEffect(() => {
    fetch('/api/discounts')
      .then((response) => response.json())
      .then((result) => setDiscounts(result?.discounts ?? []))
      .catch(() => setDiscounts([]));
  }, []);

  if (!isSearchable(query)) {
    return (
      <>
        <h1 className="text-h5 sm:text-h4 font-bold text-text-primary">Search</h1>
        <p className="mt-2 text-body-sm text-text-secondary">
          Type at least {MIN_QUERY_LENGTH} characters in the search box above.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-h5 sm:text-h4 font-bold text-text-primary">
        Results for “{query.trim()}”
      </h1>

      {/* Announced, so a screen reader learns the count rather than having to
          walk the grid to find out it is empty. */}
      <p aria-live="polite" className="mt-1 text-body-sm text-text-secondary">
        {loading
          ? 'Searching…'
          : `${products.length} product${products.length === 1 ? '' : 's'}`}
      </p>

      {categories.length > 0 && (
        <nav aria-label="Matching categories" className="mt-4 flex flex-wrap gap-2">
          {categories.map((category) => (
            <Link
              key={category.href}
              href={category.href}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-border bg-surface text-body-sm text-text-secondary hover:border-primary hover:text-primary transition-colors"
            >
              <Search className="w-3.5 h-3.5" aria-hidden="true" />
              Browse {category.label}
            </Link>
          ))}
        </nav>
      )}

      {loading && products.length === 0 && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" className="text-primary" />
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-6 p-3 rounded-control bg-destructive-background border border-destructive-border text-body-sm text-destructive"
        >
          {error}
        </p>
      )}

      {!loading && !error && products.length === 0 && resultsFor && (
        <div className="mt-8 text-center py-12">
          <p className="text-body-lg font-semibold text-text-primary">
            Nothing matches “{query.trim()}”.
          </p>
          <p className="mt-2 text-body-sm text-text-secondary">
            Try a shorter or more general word — “gown” rather than “long sleeve gown”.
          </p>
          <Link
            href="/products"
            className="inline-block mt-4 px-4 py-2 rounded-control bg-primary text-primary-foreground font-semibold text-body-sm hover:bg-primary-hover transition-colors"
          >
            Browse all products
          </Link>
        </div>
      )}

      {products.length > 0 && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product as any} discounts={discounts} />
          ))}
        </div>
      )}
    </>
  );
}
