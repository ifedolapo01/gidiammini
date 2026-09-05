/** ADMIN layer — picking a product out of the catalogue.
 *
 * The first half of AddOrderLine, which is now the variant and price step.
 * Kept separate because "find a product" is the same job on any surface that
 * needs one, and the search box plus results list has no idea what the caller
 * intends to do with the answer.
 *
 * Nothing is listed until something is typed. The catalogue is capped at 2000
 * rows and dumping the first 25 of them under an empty search box is a list
 * nobody scrolls — the search box is the interface.
 */
'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import type { PickerProduct } from '../hooks/useProductPicker';

interface ProductSearchListProps {
  search: string;
  onSearchChange: (value: string) => void;
  results: PickerProduct[];
  loading: boolean;
  onPick: (product: PickerProduct) => void;
}

export default function ProductSearchList({
  search,
  onSearchChange,
  results,
  loading,
  onPick,
}: ProductSearchListProps) {
  return (
    <>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={loading ? 'Loading the catalogue…' : 'Search products…'}
          disabled={loading}
          className="pl-9"
          aria-label="Search the catalogue"
        />
      </div>

      {search.trim() && (
        <ul className="mt-2 max-h-56 overflow-y-auto rounded-control border border-border">
          {results.length === 0 ? (
            <li className="p-3 text-body-sm text-text-secondary">Nothing matches that.</li>
          ) : (
            results.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => onPick(product)}
                  className="flex w-full items-center justify-between gap-3 p-2.5 text-left transition-colors hover:bg-surface-hover"
                >
                  <span className="text-body-sm text-text-primary">{product.name}</span>
                  <span className="shrink-0 text-body-sm text-text-secondary">
                    {formatCurrency(product.price)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </>
  );
}
