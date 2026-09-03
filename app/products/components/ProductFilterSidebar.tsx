/**
 * STOREFRONT layer — the filter rail.
 *
 * Replaces CategoryFilterSidebar, which was titled "Filters" and offered only
 * category and subcategory. It now composes one panel per facet and does no
 * filtering itself: every change goes up to the hook, which writes it to the
 * URL and lets it come back down. Nothing here holds filter state.
 *
 * Panel order is deliberate — category first because it is how most people
 * start, then price, then the attributes, then availability. Sizes are sorted
 * by size-order.ts rather than alphabetically, which is what stops "12-18
 * months" appearing above "3-6 months".
 */
'use client';

import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { sortSizes } from '@/lib/commerce/size-order';
import { toggleFacetValue, type ProductFilters } from '@/lib/commerce/product-filters';
import type { CategoryWithSubcategories, FacetOptions } from '../types';
import FacetSection from './facets/FacetSection';
import CategoryFacet from './facets/CategoryFacet';
import CheckboxFacet from './facets/CheckboxFacet';
import PriceFacet from './facets/PriceFacet';
import AvailabilityFacet from './facets/AvailabilityFacet';

interface ProductFilterSidebarProps {
  categories: CategoryWithSubcategories[];
  facets: FacetOptions;
  filters: ProductFilters;
  activeFilterCount: number;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  onChange: (change: Partial<ProductFilters>) => void;
  onClearAll: () => void;
  onNavigateCategory: (categorySlug: string, subCategorySlug?: string) => void;
}

/**
 * A dot of the colour itself. An admin types these freely, so the value is fed
 * straight to CSS and anything unrecognised ("Multicolour") simply resolves to
 * nothing — which is why the swatch keeps a border and never carries the
 * meaning on its own. The name is always spelled out beside it.
 */
function ColorSwatch({ value }: { value: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-4 shrink-0 rounded-full border border-border-strong"
      style={{ backgroundColor: value.toLowerCase().replace(/\s+/g, '') }}
    />
  );
}

export default function ProductFilterSidebar({
  categories,
  facets,
  filters,
  activeFilterCount,
  showFilters,
  setShowFilters,
  onChange,
  onClearAll,
  onNavigateCategory,
}: ProductFilterSidebarProps) {
  return (
    <aside className={`md:w-64 md:shrink-0 ${showFilters ? 'block' : 'hidden md:block'}`}>
      <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-surface border border-primary/10 bg-surface p-6 shadow-elevation-1">
        <div className="mb-6 flex items-center justify-between gap-2">
          <h2 className="flex items-center text-body-lg font-semibold text-text-primary">
            <Filter className="mr-2 size-5 text-primary" aria-hidden="true" />
            Filters
          </h2>

          <div className="flex items-center gap-1">
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearAll}>
                Clear all
              </Button>
            )}
            <button
              type="button"
              onClick={() => setShowFilters(false)}
              className="rounded-control p-1 text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:hidden"
            >
              <X className="size-5" aria-hidden="true" />
              <span className="sr-only">Close filters</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <FacetSection title="Category">
            <CategoryFacet
              categories={categories}
              selectedCategory={filters.category}
              selectedSubCategory={filters.subcategory}
              onSelectAll={() => onNavigateCategory('all', 'all')}
              onNavigate={onNavigateCategory}
            />
          </FacetSection>

          <PriceFacet
            minPrice={facets.minPrice}
            maxPrice={facets.maxPrice}
            selectedMin={filters.minPrice}
            selectedMax={filters.maxPrice}
            onSelect={(min, max) => onChange({ minPrice: min, maxPrice: max })}
          />

          <CheckboxFacet
            title="Size & age"
            options={sortSizes(facets.sizes)}
            selected={filters.sizes}
            onToggle={(value) => onChange({ sizes: toggleFacetValue(filters.sizes, value) })}
          />

          <CheckboxFacet
            title="Colour"
            options={facets.colors}
            selected={filters.colors}
            onToggle={(value) => onChange({ colors: toggleFacetValue(filters.colors, value) })}
            renderAdornment={(value) => <ColorSwatch value={value} />}
          />

          <AvailabilityFacet
            onSale={filters.onSale}
            inStockOnly={filters.inStockOnly}
            onChange={onChange}
          />
        </div>
      </div>
    </aside>
  );
}
