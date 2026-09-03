/**
 * STOREFRONT layer — the typeahead panel under the search box.
 *
 * Presentation only: SearchBox owns the query, the highlight and the keyboard
 * handling, so the two halves cannot disagree about which option is active.
 *
 * Products and category shortcuts are one continuous listbox, indexed
 * end-to-end — a category suggestion is the (products.length + n)th option, so
 * arrow keys run through both without a seam.
 */
'use client';

import { Search, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/commerce/pricing';
import type { SearchProduct, CategorySuggestion } from './hooks/useProductSearch';
import ProductImage from '@/components/commerce/ProductImage';

interface SearchDropdownProps {
  listId: string;
  query: string;
  products: SearchProduct[];
  categories: CategorySuggestion[];
  loading: boolean;
  error: string;
  highlighted: number;
  onHighlight: (index: number) => void;
  onSelect: (href: string) => void;
  onSeeAll: () => void;
}

export default function SearchDropdown({
  listId,
  query,
  products,
  categories,
  loading,
  error,
  highlighted,
  onHighlight,
  onSelect,
  onSeeAll,
}: SearchDropdownProps) {
  const empty = !loading && !error && products.length === 0 && categories.length === 0;

  return (
    <div className="absolute z-50 mt-1 w-full bg-surface border border-border rounded-surface shadow-elevation-3 overflow-hidden">
      {/* Announced politely so a screen reader hears the count without the list
          stealing focus on every keystroke. */}
      <p aria-live="polite" className="sr-only">
        {loading ? 'Searching' : `${products.length} product${products.length === 1 ? '' : 's'} found`}
      </p>

      {loading && products.length === 0 && (
        <p className="flex items-center gap-2 px-3 py-3 text-body-sm text-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Searching…
        </p>
      )}

      {error && <p className="px-3 py-3 text-body-sm text-destructive">{error}</p>}

      {empty && (
        <p className="px-3 py-3 text-body-sm text-text-secondary">
          Nothing matches “{query.trim()}”.
        </p>
      )}

      <ul id={listId} role="listbox" aria-label="Search results" className="max-h-80 overflow-y-auto">
        {products.map((product, index) => (
          <li
            key={product.id}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={highlighted === index}
            onMouseEnter={() => onHighlight(index)}
            onClick={() => onSelect(`/products/${product.id}`)}
            className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
              highlighted === index ? 'bg-background-secondary' : ''
            }`}
          >
            {product.main_image ? (
              <ProductImage
                src={product.main_image}
                alt=""
                className="w-10 h-10 rounded-control flex-shrink-0"
                sizes="40px"
              />
            ) : (
              <span className="w-10 h-10 rounded-control bg-background-tertiary flex-shrink-0" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-body-sm text-text-primary truncate">{product.name}</span>
              <span className="block text-caption-md text-text-secondary">
                {formatCurrency(product.price)}
                {product.stock <= 0 && <span className="text-text-muted"> · out of stock</span>}
              </span>
            </span>
          </li>
        ))}

        {categories.map((category, index) => {
          const optionIndex = products.length + index;
          return (
            <li
              key={category.href}
              id={`${listId}-${optionIndex}`}
              role="option"
              aria-selected={highlighted === optionIndex}
              onMouseEnter={() => onHighlight(optionIndex)}
              onClick={() => onSelect(category.href)}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-t border-divider ${
                highlighted === optionIndex ? 'bg-background-secondary' : ''
              }`}
            >
              <Search className="w-3.5 h-3.5 text-text-muted flex-shrink-0" aria-hidden="true" />
              <span className="text-body-sm text-text-secondary truncate">
                Browse {category.label}
              </span>
            </li>
          );
        })}
      </ul>

      {products.length > 0 && (
        <button
          type="button"
          onClick={onSeeAll}
          className="w-full px-3 py-2 text-body-sm text-primary hover:bg-background-secondary border-t border-divider text-left"
        >
          See all results for “{query.trim()}”
        </button>
      )}
    </div>
  );
}
