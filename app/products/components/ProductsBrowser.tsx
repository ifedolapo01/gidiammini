/**
 * STOREFRONT layer — the interactive shell around a server-rendered listing.
 *
 * The products it first renders came from the server component already built;
 * this adds the parts that need a browser — the filter rail, the sort control,
 * the mobile drawer toggle, and "Load more". Everything below the first page is
 * fetched from /api/products, which runs the same loader the server component
 * did.
 */
'use client';

import { useMemo, useState } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui';
import type { ProductCardProduct } from '@/types/product';
import type { Discount } from '@/lib/commerce/discounts';
import { countActiveFilters, type ProductFilters } from '@/lib/commerce/product-filters';
import type { CategoryWithSubcategories, FacetOptions } from '../types';
import { useProductFilterNav } from '../hooks/useProductFilterNav';
import { useLoadMoreProducts } from '../hooks/useLoadMoreProducts';
import ProductFilterSidebar from './ProductFilterSidebar';
import ProductSortSelect from './ProductSortSelect';
import ActiveFilterChips from './ActiveFilterChips';
import ProductsGrid from './ProductsGrid';
import LoadMoreButton from './LoadMoreButton';

interface ProductsBrowserProps {
  initialProducts: ProductCardProduct[];
  initialCursor: string | null;
  /** Null when the on-sale facet is on and no exact count is available. */
  total: number | null;
  categories: CategoryWithSubcategories[];
  discounts: Discount[];
  facets: FacetOptions;
  filters: ProductFilters;
}

export default function ProductsBrowser({
  initialProducts,
  initialCursor,
  total,
  categories,
  discounts,
  facets,
  filters,
}: ProductsBrowserProps) {
  const [showFilters, setShowFilters] = useState(false);
  const { pending, updateFilters, clearFilters, navigateToCategory } = useProductFilterNav(filters);
  const { products, loading, error, hasMore, loadMore } = useLoadMoreProducts({
    filters,
    initialProducts,
    initialCursor,
  });

  const activeFilterCount = countActiveFilters(filters);

  // Slug → display name, so a filter chip reads "Baby Gowns" and not
  // "baby-gowns". Built from the same category tree the sidebar renders.
  const categoryLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const category of categories) {
      labels[category.slug] = category.name;
      for (const sub of category.subcategories ?? []) labels[sub.slug] = sub.name;
    }
    return labels;
  }, [categories]);

  const countLabel = () => {
    if (products.length === 0) return 'No products found';
    // With the on-sale facet on there is no exact total — counting discounted
    // products means running the discount rules over the whole catalogue — so
    // the line says what is on screen instead of inventing a number.
    if (total === null) {
      return `Showing ${products.length} product${products.length === 1 ? '' : 's'}${hasMore ? ' so far' : ''}`;
    }
    return `Showing ${products.length} of ${total} product${total === 1 ? '' : 's'}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-8 md:flex-row">
        <ProductFilterSidebar
          categories={categories}
          facets={facets}
          filters={filters}
          activeFilterCount={activeFilterCount}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          onChange={updateFilters}
          onClearAll={clearFilters}
          onNavigateCategory={navigateToCategory}
        />

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-h3 font-extrabold tracking-tight text-text-primary">
                Our Collection
              </h1>
              {/* aria-live, because after a filter change this line is the only
                  thing that says how many results there now are. */}
              <p aria-live="polite" className="mt-1 text-text-secondary">
                {countLabel()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <ProductSortSelect
                value={filters.sort}
                onChange={(sort) => updateFilters({ sort })}
                disabled={pending}
              />
              <Button
                variant="outline"
                size="md"
                onClick={() => setShowFilters(true)}
                className="md:hidden"
              >
                <Filter className="mr-2 size-4" aria-hidden="true" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-2 rounded-full bg-primary px-1.5 text-caption-md font-semibold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>
          </div>

          <ActiveFilterChips
            filters={filters}
            categoryLabels={categoryLabels}
            onChange={updateFilters}
            onClearAll={clearFilters}
          />

          {/* Dimmed rather than replaced by skeletons: the previous results are
              still on screen and still true until the new ones arrive. */}
          <div className={pending ? 'opacity-50 transition-opacity' : undefined} aria-busy={pending}>
            <ProductsGrid
              products={products}
              discounts={discounts}
              hasActiveFilters={activeFilterCount > 0}
              onClearFilters={clearFilters}
            />
          </div>

          <LoadMoreButton
            hasMore={hasMore}
            loading={loading}
            error={error}
            loadedCount={products.length}
            total={total}
            onLoadMore={loadMore}
          />
        </div>
      </div>
    </div>
  );
}
