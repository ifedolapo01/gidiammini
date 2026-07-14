/** COMMERCE layer — shared quantity stepper. Used by Storefront and Admin. */
'use client';

import { cn } from '@/lib/utils';

interface QuantitySelectorProps {
  quantity: number;
  onChange: (next: number) => void;
  /** Floor for decrement; when set, the decrement button disables at this value. Omit to allow decrementing below (e.g. to trigger removal). */
  min?: number;
  /** Ceiling for increment; when set, the increment button disables at this value. */
  max?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function QuantitySelector({ quantity, onChange, min, max, size = 'md', className }: QuantitySelectorProps) {
  const atMin = min !== undefined && quantity <= min;
  const atMax = max !== undefined && quantity >= max;

  const decrement = () => onChange(min !== undefined ? Math.max(min, quantity - 1) : quantity - 1);
  const increment = () => onChange(max !== undefined ? Math.min(max, quantity + 1) : quantity + 1);

  if (size === 'sm') {
    return (
      <div className={cn('flex items-center', className)}>
        <button
          type="button"
          onClick={decrement}
          disabled={atMin}
          aria-label="Decrease quantity"
          className="w-7 h-7 sm:w-8 sm:h-8 border border-border rounded-l-control text-body-sm flex items-center justify-center hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          -
        </button>
        <span className="w-8 sm:w-10 text-center text-body-sm sm:text-body-md">{quantity}</span>
        <button
          type="button"
          onClick={increment}
          disabled={atMax}
          aria-label="Increase quantity"
          className="w-7 h-7 sm:w-8 sm:h-8 border border-border rounded-r-control text-body-sm flex items-center justify-center hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center border rounded-control text-text-primary', className ?? 'border-border')}>
      <button
        type="button"
        onClick={decrement}
        disabled={atMin}
        aria-label="Decrease quantity"
        className="px-4 py-3 hover:bg-surface-hover text-body-lg disabled:opacity-50"
      >
        -
      </button>
      <span className="px-4 py-3 w-12 text-center">{quantity}</span>
      <button
        type="button"
        onClick={increment}
        disabled={atMax}
        aria-label="Increase quantity"
        className="px-4 py-3 hover:bg-surface-hover text-body-lg disabled:opacity-50"
      >
        +
      </button>
    </div>
  );
}
