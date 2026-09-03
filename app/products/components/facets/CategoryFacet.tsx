/**
 * STOREFRONT layer — the category / subcategory facet.
 *
 * Lifted unchanged in behaviour out of the old CategoryFilterSidebar, which had
 * been the whole of "Filters". Subcategories still reveal themselves only under
 * the selected category, so the panel stays short.
 *
 * Buttons rather than checkboxes because category is single-select and
 * navigational: picking one replaces the current view rather than adding to it.
 */
'use client';

interface CategoryWithSubcategories {
  name: string;
  slug: string;
  subcategories?: { name: string; slug: string }[];
}

interface CategoryFacetProps {
  categories: CategoryWithSubcategories[];
  selectedCategory: string;
  selectedSubCategory: string;
  onSelectAll: () => void;
  onNavigate: (categorySlug: string, subCategorySlug?: string) => void;
}

const BASE =
  'block w-full text-left px-3 py-2 rounded-control transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';
const SELECTED = 'bg-primary/10 text-primary border border-primary/20 font-semibold';
const UNSELECTED = 'hover:bg-surface-hover text-text-primary font-medium';

const SUB_BASE =
  'block w-full text-left px-3 py-1.5 rounded-control text-body-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';
const SUB_SELECTED = 'text-primary font-semibold bg-primary/10';
const SUB_UNSELECTED = 'text-text-secondary hover:text-text-primary hover:bg-surface-hover';

export default function CategoryFacet({
  categories,
  selectedCategory,
  selectedSubCategory,
  onSelectAll,
  onNavigate,
}: CategoryFacetProps) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onSelectAll}
        aria-current={selectedCategory === 'all' ? 'true' : undefined}
        className={`${BASE} ${selectedCategory === 'all' ? SELECTED : UNSELECTED}`}
      >
        All Products
      </button>

      {categories.map((category) => {
        const isSelected = selectedCategory === category.slug;

        return (
          <div key={category.slug} className="space-y-1">
            <button
              type="button"
              onClick={() => onNavigate(category.slug, 'all')}
              aria-current={isSelected ? 'true' : undefined}
              className={`${BASE} ${isSelected ? SELECTED : UNSELECTED}`}
            >
              {category.name}
            </button>

            {isSelected && category.subcategories && category.subcategories.length > 0 && (
              <div className="mb-2 ml-2 space-y-1 border-l-2 border-primary/10 py-1 pl-4 pr-2">
                <button
                  type="button"
                  onClick={() => onNavigate(category.slug, 'all')}
                  className={`${SUB_BASE} ${selectedSubCategory === 'all' ? SUB_SELECTED : SUB_UNSELECTED}`}
                >
                  All {category.name}
                </button>

                {category.subcategories.map((sub) => (
                  <button
                    key={sub.slug}
                    type="button"
                    onClick={() => onNavigate(category.slug, sub.slug)}
                    className={`${SUB_BASE} ${selectedSubCategory === sub.slug ? SUB_SELECTED : SUB_UNSELECTED}`}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
