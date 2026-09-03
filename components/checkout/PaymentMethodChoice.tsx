/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// Two ways to pay, side by side.
//
// Online is listed first and preselected, because it is the one that ends the
// wait — but transfer is not demoted to a link or hidden behind "other
// methods". Plenty of customers here prefer it, some have no card, and a
// checkout that buries the familiar option to promote a new one loses the
// buyers it was meant to keep.
//
// Each option says what actually happens next, which is the real difference
// between them: one confirms in seconds, the other needs a screenshot and a
// person.
'use client';

import { Building2, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PaymentMethod = 'online' | 'transfer';

interface PaymentMethodChoiceProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  /** When the provider is not configured, only transfer is offered — and this
   *  component renders nothing rather than a choice of one. */
  onlineAvailable: boolean;
}

const OPTIONS: Array<{
  value: PaymentMethod;
  label: string;
  detail: string;
  Icon: typeof CreditCard;
}> = [
  {
    value: 'online',
    label: 'Pay now',
    detail: 'Card, bank, USSD or transfer. Confirmed straight away.',
    Icon: CreditCard,
  },
  {
    value: 'transfer',
    label: 'Bank transfer',
    detail: 'Transfer yourself, upload the receipt, and we confirm it by hand.',
    Icon: Building2,
  },
];

export default function PaymentMethodChoice({
  value,
  onChange,
  onlineAvailable,
}: PaymentMethodChoiceProps) {
  if (!onlineAvailable) return null;

  return (
    <div role="radiogroup" aria-label="How would you like to pay?" className="mb-6 grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((option) => {
        const selected = value === option.value;

        return (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-surface border p-4 transition-colors',
              'focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2',
              selected
                ? 'border-primary bg-primary/5'
                : 'border-border bg-surface hover:bg-surface-hover'
            )}
          >
            <input
              type="radio"
              name="payment-method"
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <option.Icon
              className={cn('mt-0.5 h-5 w-5 shrink-0', selected ? 'text-primary' : 'text-text-secondary')}
              aria-hidden="true"
            />
            <span>
              <span
                className={cn(
                  'block text-body-md font-semibold',
                  selected ? 'text-primary' : 'text-text-primary'
                )}
              >
                {option.label}
              </span>
              <span className="mt-0.5 block text-caption-md text-text-secondary">{option.detail}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
