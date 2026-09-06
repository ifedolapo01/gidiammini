/**
 * STOREFRONT layer — the filter rail, in its two forms.
 *
 * On a laptop it is a sticky column beside the grid. On a phone it is a
 * dialog, and that is the part that changed: it used to be the same <aside>
 * with `hidden` swapped for `block`, which meant an overlay covering the page
 * that trapped no focus, ignored Escape, left the grid behind it in the tab
 * order, and told assistive technology nothing about being a layer at all.
 *
 * Both forms render FilterFacets, so there is one definition of the controls.
 * Core's Modal supplies the focus trap, Escape, focus restoration and
 * body-scroll lock — the same primitive the cart drawer is built on.
 */
'use client';

import { Filter } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import type { ProductFilters } from '@/lib/commerce/product-filters';
import type { CategoryWithSubcategories, FacetOptions } from '../types';
import FilterFacets from './facets/FilterFacets';

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

/** "Clear all", shown only when there is something to clear. */
function ClearAllButton({ count, onClearAll }: { count: number; onClearAll: () => void }) {
  if (count === 0) return null;
  return (
    <Button variant="ghost" size="sm" onClick={onClearAll}>
      Clear all
      <span className="sr-only"> — {count} filter{count === 1 ? '' : 's'}</span>
    </Button>
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
  const facetProps = { categories, facets, filters, onChange, onNavigateCategory };

  return (
    <>
      {/* Desktop rail. Never the mobile panel now, so it carries no close
          control and no visibility toggle — it is simply absent below md. */}
      <aside className="hidden md:block md:w-64 md:shrink-0">
        <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-surface border border-primary/10 bg-surface p-6 shadow-elevation-1">
          <div className="mb-6 flex items-center justify-between gap-2">
            <h2 className="flex items-center text-body-lg font-semibold text-text-primary">
              <Filter className="mr-2 size-5 text-primary" aria-hidden="true" />
              Filters
            </h2>
            <ClearAllButton count={activeFilterCount} onClearAll={onClearAll} />
          </div>

          <FilterFacets {...facetProps} />
        </div>
      </aside>

      {/* Mobile dialog. Only ever opened by the "Filters" button, which is
          itself md:hidden, so this stays closed on a laptop. */}
      <Modal
        open={showFilters}
        onClose={() => setShowFilters(false)}
        placement="right"
        title="Filters"
        padded={false}
      >
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <FilterFacets {...facetProps} />
          </div>

          {/* Pinned, because on a phone the two things you want after changing
              a filter are both at the bottom of a long scroll otherwise. */}
          <div className="flex shrink-0 items-center gap-2 border-t border-border bg-surface px-6 py-4">
            <ClearAllButton count={activeFilterCount} onClearAll={onClearAll} />
            <Button className="flex-1" onClick={() => setShowFilters(false)}>
              Show results
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
