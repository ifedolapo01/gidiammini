/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Filter } from 'lucide-react';

interface CategoryWithSubcategories {
  name: string;
  slug: string;
  subcategories?: { name: string; slug: string }[];
}

interface CategoryFilterSidebarProps {
  categories: CategoryWithSubcategories[];
  selectedCategory: string;
  selectedSubCategory: string;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  onSelectAll: () => void;
  onNavigate: (categorySlug: string, subCategorySlug?: string) => void;
}

export default function CategoryFilterSidebar({
  categories,
  selectedCategory,
  selectedSubCategory,
  showFilters,
  setShowFilters,
  onSelectAll,
  onNavigate,
}: CategoryFilterSidebarProps) {
  return (
    <aside className={`md:w-64 ${showFilters ? 'block' : 'hidden md:block'}`}>
      <div className="sticky top-24 bg-surface p-6 rounded-surface shadow-elevation-1 border border-primary/10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-body-lg font-semibold flex items-center text-text-primary">
            <Filter className="w-5 h-5 mr-2 text-primary" />
            Filters
          </h3>
          <button
            onClick={() => setShowFilters(false)}
            className="md:hidden text-text-secondary"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="font-medium mb-3 text-text-primary">Category</h4>
            <div className="space-y-2">
              <button
                onClick={onSelectAll}
                className={`block w-full text-left px-3 py-2 rounded-control transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-primary/10 text-primary border border-primary/20 font-semibold'
                    : 'hover:bg-surface-hover text-text-primary font-medium'
                }`}
              >
                All Products
              </button>
              {categories.map(category => (
                <div key={category.slug} className="space-y-1">
                  <button
                    onClick={() => onNavigate(category.slug, 'all')}
                    className={`block w-full text-left px-3 py-2 rounded-control transition-colors ${
                      selectedCategory === category.slug
                        ? 'bg-primary/10 text-primary border border-primary/20 font-semibold'
                        : 'hover:bg-surface-hover text-text-primary font-medium'
                    }`}
                  >
                    {category.name}
                  </button>

                  {/* Subcategories (only show if parent category is selected) */}
                  {selectedCategory === category.slug && category.subcategories && category.subcategories.length > 0 && (
                    <div className="pl-4 pr-2 py-1 space-y-1 border-l-2 border-primary/10 ml-2 mb-2">
                      <button
                        onClick={() => onNavigate(category.slug, 'all')}
                        className={`block w-full text-left px-3 py-1.5 rounded-control text-body-sm transition-colors ${
                          selectedSubCategory === 'all'
                            ? 'text-primary font-semibold bg-primary/10'
                            : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                        }`}
                      >
                        All {category.name}
                      </button>
                      {category.subcategories.map(sub => (
                        <button
                          key={sub.slug}
                          onClick={() => onNavigate(category.slug, sub.slug)}
                          className={`block w-full text-left px-3 py-1.5 rounded-control text-body-sm transition-colors ${
                            selectedSubCategory === sub.slug
                              ? 'text-primary font-semibold bg-primary/10'
                              : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                          }`}
                        >
                          {sub.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
