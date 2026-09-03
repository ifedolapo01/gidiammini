/**
 * STOREFRONT layer — what is currently narrowing the list, and how to undo it.
 *
 * With five facets and a collapsible sidebar it becomes genuinely easy to
 * forget that "Include sold out" is still ticked from ten minutes ago and
 * conclude the store has stopped stocking something. Every applied filter gets
 * a chip that says so and removes itself when pressed.
 *
 * Each chip is one <button> that removes one filter. No chip for sort or page,
 * because neither hides a product.
 */
'use client';

import { X } from 'lucide-react';
import { describePriceRange } from '@/lib/commerce/price-bands';
import type { ProductFilters } from '@/lib/commerce/product-filters';

interface Chip {
  key: string;
  label: string;
  /** The filter change that removes just this chip. */
  clear: Partial<ProductFilters>;
}

interface ActiveFilterChipsProps {
  filters: ProductFilters;
  /** Display names for slugs — a chip should say "Baby Gowns", not "baby-gowns". */
  categoryLabels: Record<string, string>;
  onChange: (change: Partial<ProductFilters>) => void;
  onClearAll: () => void;
}

function buildChips(filters: ProductFilters, labels: Record<string, string>): Chip[] {
  const chips: Chip[] = [];

  if (filters.category !== 'all') {
    chips.push({
      key: 'category',
      label: labels[filters.category] ?? filters.category,
      // Dropping a category drops its subcategory with it: a subcategory
      // without its parent selects nothing.
      clear: { category: 'all', subcategory: 'all' },
    });
  }

  if (filters.subcategory !== 'all') {
    chips.push({
      key: 'subcategory',
      label: labels[filters.subcategory] ?? filters.subcategory,
      clear: { subcategory: 'all' },
    });
  }

  if (filters.minPrice !== null || filters.maxPrice !== null) {
    chips.push({
      key: 'price',
      label: describePriceRange(filters.minPrice, filters.maxPrice),
      clear: { minPrice: null, maxPrice: null },
    });
  }

  for (const size of filters.sizes) {
    chips.push({
      key: `size:${size}`,
      label: `Size ${size}`,
      clear: { sizes: filters.sizes.filter((value) => value !== size) },
    });
  }

  for (const color of filters.colors) {
    chips.push({
      key: `color:${color}`,
      label: color,
      clear: { colors: filters.colors.filter((value) => value !== color) },
    });
  }

  if (filters.onSale) {
    chips.push({ key: 'sale', label: 'On sale', clear: { onSale: false } });
  }

  if (filters.inStockOnly) {
    chips.push({ key: 'stock', label: 'In stock only', clear: { inStockOnly: false } });
  }

  return chips;
}

export default function ActiveFilterChips({
  filters,
  categoryLabels,
  onChange,
  onClearAll,
}: ActiveFilterChipsProps) {
  const chips = buildChips(filters, categoryLabels);

  if (chips.length === 0) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <h2 className="sr-only">Active filters</h2>

      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onChange(chip.clear)}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 py-1 pl-3 pr-2 text-caption-md font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {chip.label}
          <X className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}

      <button
        type="button"
        onClick={onClearAll}
        className="rounded-control px-2 py-1 text-caption-md font-medium text-text-secondary underline-offset-2 hover:text-text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        Clear all
      </button>
    </div>
  );
}
