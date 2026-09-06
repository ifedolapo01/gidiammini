/** COMMERCE layer — shared quantity stepper. Used by Storefront and Admin. */
'use client';

import { cn } from '@/lib/utils';
import { announce } from '@/lib/announce';

interface QuantitySelectorProps {
  quantity: number;
  onChange: (next: number) => void;
  /** Floor for decrement; when set, the decrement button disables at this value. Omit to allow decrementing below (e.g. to trigger removal). */
  min?: number;
  /** Ceiling for increment; when set, the increment button disables at this value. */
  max?: number;
  /**
   * Names what is being counted, for the announcement only ("Quantity 3 —
   * Ribbed Bodysuit"). Optional; without it the announcement is just the
   * number, which is still better than the silence this had before.
   */
  announceLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function QuantitySelector({
  quantity,
  onChange,
  min,
  max,
  size = 'md',
  className,
  announceLabel,
}: QuantitySelectorProps) {
  const atMin = min !== undefined && quantity <= min;
  const atMax = max !== undefined && quantity >= max;

  /**
   * The buttons are labelled "Increase quantity" / "Decrease quantity", so a
   * screen reader says what the control does and then nothing at all about
   * what happened — the number beside it changes silently. This is the only
   * feedback there is for the press.
   */
  const applyAndAnnounce = (next: number) => {
    onChange(next);
    announce(announceLabel ? `Quantity ${next} — ${announceLabel}` : `Quantity ${next}`);
  };

  const decrement = () =>
    applyAndAnnounce(min !== undefined ? Math.max(min, quantity - 1) : quantity - 1);
  const increment = () =>
    applyAndAnnounce(max !== undefined ? Math.min(max, quantity + 1) : quantity + 1);

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
