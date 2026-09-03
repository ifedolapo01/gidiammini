/**
 * STOREFRONT layer — the sort control.
 *
 * A native <select> through the Select primitive rather than a custom menu: it
 * is one choice from five, it needs to work on a phone, and the platform
 * control is already keyboard- and screen-reader-correct.
 */
'use client';

import { useId } from 'react';
import { Select } from '@/components/ui';
import { SORT_OPTIONS, type SortValue } from '@/lib/commerce/product-filters';

interface ProductSortSelectProps {
  value: SortValue;
  onChange: (value: SortValue) => void;
  disabled?: boolean;
}

export default function ProductSortSelect({ value, onChange, disabled }: ProductSortSelectProps) {
  const selectId = useId();

  return (
    <div className="flex items-center gap-2">
      {/* Visible rather than a placeholder option, so the control still says
          what it does once a value other than the default is chosen. */}
      <label htmlFor={selectId} className="whitespace-nowrap text-body-sm text-text-secondary">
        Sort by
      </label>
      <Select
        id={selectId}
        size="sm"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as SortValue)}
        className="w-auto min-w-[11rem]"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
