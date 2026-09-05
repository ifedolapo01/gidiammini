/** ADMIN layer — how the money arrived.
 *
 * A segmented row rather than a select, because it has four options that never
 * grow and it is used on a phone: four 44px targets beat a native picker that
 * covers the receipt you are reading from.
 *
 * 'transfer' is the default and by far the common case; the other three exist
 * because money genuinely arrives by them and a queue that cannot record a
 * cash sale sends somebody back to editing the order status by hand.
 */
'use client';

import { cn } from '@/lib/utils';
import type { PaymentMethod } from '@/types/payment';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'transfer', label: 'Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'pos', label: 'POS' },
  { value: 'paystack', label: 'Online' },
];

interface PaymentMethodFieldProps {
  value: PaymentMethod | undefined;
  onChange: (method: PaymentMethod) => void;
}

export function PaymentMethodField({ value = 'transfer', onChange }: PaymentMethodFieldProps) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-body-sm font-medium text-text-primary">How it arrived</legend>
      <div className="grid grid-cols-4 gap-1 rounded-control bg-background-tertiary p-1">
        {METHODS.map((method) => {
          const active = method.value === value;

          return (
            <button
              key={method.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(method.value)}
              className={cn(
                'min-h-11 rounded-control text-body-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus',
                active
                  ? 'bg-surface text-text-primary shadow-elevation-1'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {method.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
