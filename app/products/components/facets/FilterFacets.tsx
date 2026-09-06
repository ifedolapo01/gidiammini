/**
 * STOREFRONT layer — the stack of filter panels itself, with no chrome around it.
 *
 * Split out of ProductFilterSidebar so the desktop rail and the mobile dialog
 * render the same controls from one definition rather than two copies that
 * drift. Nothing here holds state: every change goes straight up.
 *
 * Panel order is deliberate — category first because it is how most people
 * start, then price, then the attributes, then availability. Sizes are sorted
 * by size-order.ts rather than alphabetically, which is what stops "12-18
 * months" appearing above "3-6 months".
 */
'use client';

import { sortSizes } from '@/lib/commerce/size-order';
import { toggleFacetValue, type ProductFilters } from '@/lib/commerce/product-filters';
import type { CategoryWithSubcategories, FacetOptions } from '../../types';
import FacetSection from './FacetSection';
import CategoryFacet from './CategoryFacet';
import CheckboxFacet from './CheckboxFacet';
import PriceFacet from './PriceFacet';
import AvailabilityFacet from './AvailabilityFacet';

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

interface FilterFacetsProps {
  categories: CategoryWithSubcategories[];
  facets: FacetOptions;
  filters: ProductFilters;
  onChange: (change: Partial<ProductFilters>) => void;
  onNavigateCategory: (categorySlug: string, subCategorySlug?: string) => void;
}

export default function FilterFacets({
  categories,
  facets,
  filters,
  onChange,
  onNavigateCategory,
}: FilterFacetsProps) {
  return (
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
  );
}
