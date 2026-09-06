/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// The code box, in the order summary beside the total it changes.
//
// No Apply button, and that is the point. A separate apply action means a
// second round trip, a second loading state, and a customer who types a code,
// does not press Apply, and is charged full price wondering why. The code
// travels with the quote the checkout already fetches at the step-1 gate, so
// it is validated at exactly the moment the total is decided and cannot
// disagree with it.
//
// What the server said comes back through the quote and is shown here rather
// than only as a toast, because a toast is gone by the time somebody scrolls
// back to check.
'use client';

import { Tag } from 'lucide-react';
import { Input } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import type { AppliedCode } from './hooks/useCheckoutQuote';

interface DiscountCodeFieldProps {
  /** Both order summaries are in the DOM at once — one hidden behind a
   *  breakpoint, one inside a dialog — so a fixed id would give two inputs the
   *  same one and break the label on whichever lost. */
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** The verdict from the last quote, if there has been one. */
  applied: AppliedCode | null;
  error: string | null;
  disabled?: boolean;
}

export default function DiscountCodeField({
  id,
  value,
  onChange,
  applied,
  error,
  disabled,
}: DiscountCodeFieldProps) {
  const saved = applied ? applied.saved_on_items + applied.saved_on_shipping : 0;

  return (
    <div className="border-t border-border pt-3 md:pt-4 mb-3 md:mb-4">
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-body-sm font-medium text-text-primary mb-2"
      >
        <Tag size={15} aria-hidden />
        Discount code
      </label>

      <Input
        id={id}
        value={value}
        // Uppercased as they type, matching how the code is stored and how it
        // is printed on whatever they got it from.
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        placeholder="Optional"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        disabled={disabled}
        invalid={!!error}
        aria-describedby={`${id}-status`}
        maxLength={32}
      />

      {/* One live region for all three outcomes, so a screen reader is told
          the result once rather than hearing the field re-announced. */}
      <p id={`${id}-status`} role="status" className="mt-1.5 text-caption-md">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : applied && saved > 0 ? (
          <span className="text-success">
            {applied.code} applied — you saved {formatCurrency(saved)}
            {applied.saved_on_shipping > 0 && applied.saved_on_items === 0 ? ' on delivery' : ''}.
          </span>
        ) : applied ? (
          // Valid, but a sale already running beat it on every line. Saying
          // "applied" and changing nothing is what makes people distrust the
          // field.
          <span className="text-text-secondary">
            {applied.code} is valid, but the prices you already have are better.
          </span>
        ) : (
          <span className="text-text-secondary">
            Applied when you continue to payment.
          </span>
        )}
      </p>
    </div>
  );
}
