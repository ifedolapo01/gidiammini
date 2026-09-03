/**
 * STOREFRONT layer — the results grid, or an explanation of why it is empty.
 *
 * No loading state: the first page is rendered by the server component before
 * this reaches the browser, and every page after it is appended beneath a
 * button that owns its own pending state. There is no moment when this
 * component has nothing to draw and is waiting.
 *
 * The empty state differs by cause. No filters applied means the category
 * really is bare; filters applied means the shopper can get results back by
 * relaxing one — and saying so is the difference between a dead end and a next
 * step.
 */
'use client';

import { Button } from '@/components/ui';
import ProductCard from '@/components/commerce/ProductCard';
import type { ProductCardProduct } from '@/types/product';
import type { Discount } from '@/lib/commerce/discounts';

interface ProductsGridProps {
  products: ProductCardProduct[];
  discounts: Discount[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export default function ProductsGrid({
  products,
  discounts,
  hasActiveFilters,
  onClearFilters,
}: ProductsGridProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-surface border border-primary/10 bg-surface p-8 py-16 text-center shadow-elevation-1">
        <p className="text-body-lg font-medium text-text-secondary">
          {hasActiveFilters
            ? 'No products match these filters.'
            : 'No products in this collection yet.'}
        </p>
        <p className="mt-2 text-body-sm text-text-muted">
          {hasActiveFilters
            ? 'Try removing a filter — a wider price range or another size usually brings results back.'
            : 'Check back soon, or browse another collection.'}
        </p>
        {hasActiveFilters && (
          <Button variant="outline" size="md" className="mt-4" onClick={onClearFilters}>
            Clear all filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          discounts={discounts}
          // The first row only. This grid is the top of the page, so its
          // images are the largest paint; everything below the fold stays
          // lazy. Three matches the widest layout (lg:grid-cols-3) — on a
          // phone that eagerly fetches one extra card, which is a better
          // trade than the first visible image waiting on the lazy observer.
          priority={index < 3}
        />
      ))}
    </div>
  );
}
