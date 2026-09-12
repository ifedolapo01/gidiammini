/** ADMIN layer — how a counter sale was paid for: cash in hand, or a card/
 *  transfer taken through a POS machine. Both are settled the moment the sale
 *  is rung up — unlike the online checkout's transfer, there is nothing here
 *  for anyone to verify afterwards. */
'use client';

import { Banknote, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PaymentMethod } from '../hooks/useCounterSale';

interface PaymentMethodPickerProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

const OPTIONS: Array<{ value: PaymentMethod; label: string; Icon: typeof Banknote }> = [
  { value: 'cash', label: 'Cash', Icon: Banknote },
  { value: 'pos', label: 'Card / POS', Icon: CreditCard },
];

export default function PaymentMethodPicker({ value, onChange }: PaymentMethodPickerProps) {
  return (
    <div role="radiogroup" aria-label="How was this sale paid for?" className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((option) => {
        const selected = value === option.value;

        return (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-surface border p-3 transition-colors',
              'focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2',
              selected
                ? 'border-primary bg-primary/5'
                : 'border-border bg-surface hover:bg-surface-hover'
            )}
          >
            <input
              type="radio"
              name="counter-sale-payment-method"
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <option.Icon
              className={cn('size-5 shrink-0', selected ? 'text-primary' : 'text-text-secondary')}
              aria-hidden="true"
            />
            <span
              className={cn(
                'text-body-sm font-semibold',
                selected ? 'text-primary' : 'text-text-primary'
              )}
            >
              {option.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}
