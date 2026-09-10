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
import ColorSwatch from '@/components/commerce/ColorSwatch';

interface FilterFacetsProps {
  categories: CategoryWithSubcategories[];
  facets: FacetOptions;
  filters: ProductFilters;
  onChange: (change: Partial<ProductFilters>) => void;
  onNavigateCategory: (categorySlug: string, subCategorySlug?: string, subSubCategorySlug?: string) => void;
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
          selectedSubSubCategory={filters.subsubcategory}
          onSelectAll={() => onNavigateCategory('all', 'all', 'all')}
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
