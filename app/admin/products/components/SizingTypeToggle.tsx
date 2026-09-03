/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// Which kind of sizing this product uses.
//
// Extracted from PricingVariantsEditor when 'maternity' was added: that file
// was at 195 lines and this is a self-contained control with three options and
// a real consequence — it decides which chart the storefront's size guide
// shows, on top of the label above the size inputs.
//
// A radio group with the inputs visually hidden, so the whole pill is the
// click target while the input keeps the keyboard behaviour and the focus
// ring. Arrow keys move between the three because they share a name.
'use client';

import { cn } from '@/lib/utils';
import type { SizingType } from '@/lib/commerce/product-form-schema';

const OPTIONS: Array<{ value: SizingType; label: string }> = [
  { value: 'size', label: 'Sizes (S, M, L)' },
  { value: 'age', label: 'Ages (3-6m)' },
  { value: 'maternity', label: 'Maternity' },
];

interface SizingTypeToggleProps {
  value: SizingType;
  onChange: (value: SizingType) => void;
}

export function SizingTypeToggle({ value, onChange }: SizingTypeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="How this product is sized"
      className="ml-auto flex items-center bg-background-secondary rounded-control border border-border p-1"
    >
      {OPTIONS.map((option) => (
        <label
          key={option.value}
          className={cn(
            'cursor-pointer px-3 py-1 rounded-control text-caption-md font-medium transition-colors',
            'focus-within:ring-2 focus-within:ring-focus',
            value === option.value
              ? 'bg-primary/10 text-primary'
              : 'text-text-secondary hover:bg-surface-hover'
          )}
        >
          <input
            type="radio"
            name="sizing_type_toggle"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
