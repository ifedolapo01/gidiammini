/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// How this garment runs, in the admin form.
//
// One radio group and one sentence, placed straight after the sizes because
// that is the same decision: an admin who has just typed "0-3 months, 3-6
// months" is the person who knows whether it comes up small.
//
// "Not recorded" is the default and is a real option, not a missing value. A
// form that defaults to "true to size" makes a claim on the shop's behalf that
// nobody checked, and the storefront would print it beside every product.
'use client';

import type { UseFormRegister } from 'react-hook-form';
import { Textarea } from '@/components/ui';
import type { ProductFormValues } from '@/lib/commerce/product-form-schema';

interface ProductFitSectionProps {
  register: UseFormRegister<ProductFormValues>;
}

const OPTIONS: Array<{ value: string; label: string; hint: string }> = [
  { value: '', label: 'Not recorded', hint: 'Nothing is shown to shoppers' },
  { value: 'runs_small', label: 'Runs small', hint: 'We suggest sizing up' },
  { value: 'true_to_size', label: 'True to size', hint: 'Go by the measurements' },
  { value: 'runs_large', label: 'Runs large', hint: 'We suggest sizing down' },
];

export function ProductFitSection({ register }: ProductFitSectionProps) {
  return (
    <div className="bg-background-secondary p-5 rounded-surface border border-border-light space-y-4">
      <div>
        <label className="block text-body-sm font-bold text-text-primary">Fit</label>
        {/* One string expression rather than JSX text with entities in it:
            mixing the two normalises differently in the server and client
            graphs here, which React reports as a hydration mismatch. */}
        <p className="mt-1 text-caption-md text-text-secondary">
          {`Shown under the size buttons and at the top of the size guide. This is the single thing that reduces "it didn't fit" messages, so it is worth filling in even when the answer is "true to size".`}
        </p>
      </div>

      <fieldset>
        <legend className="sr-only">How this product runs against its stated size</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {OPTIONS.map((option) => (
            <label
              key={option.value || 'unset'}
              className="flex cursor-pointer items-start gap-2 rounded-control border border-border bg-surface p-3 transition-colors hover:bg-surface-hover focus-within:ring-2 focus-within:ring-focus"
            >
              <input
                type="radio"
                value={option.value}
                {...register('fit_rating')}
                className="mt-1 accent-primary"
              />
              <span>
                <span className="block text-body-sm font-medium text-text-primary">
                  {option.label}
                </span>
                <span className="block text-caption-md text-text-secondary">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label
          htmlFor="fit_note"
          className="mb-1 block text-body-sm font-medium text-text-primary"
        >
          Anything specific? <span className="text-text-secondary">(optional)</span>
        </label>
        <Textarea
          id="fit_note"
          rows={2}
          maxLength={300}
          placeholder="The neck opening is snug on bigger heads — the popper side helps."
          {...register('fit_note')}
        />
        <p className="mt-1 text-caption-md text-text-secondary">
          {'One sentence, shown under the fit rating. Specifics beat adjectives: which part is tight, not "fits nicely".'}
        </p>
      </div>
    </div>
  );
}
