/**
 * STOREFRONT layer — "how did it fit?", asked while the memory is fresh.
 *
 * The highest-leverage field this form can ask: fit is the number one driver
 * of returns and change requests in clothing, and nothing before this closed
 * the loop between a size guess and what actually happened. Optional, with a
 * real "Skip" choice rather than defaulting to one of the three answers — an
 * unanswered question must stay distinguishable from "true to size", or the
 * aggregate on the product page would be reporting an opinion nobody gave it.
 */
'use client';

import { fitLabel, type FitRating } from '@/lib/commerce/size-guide';

const OPTIONS: readonly FitRating[] = ['runs_small', 'true_to_size', 'runs_large'];

interface ReviewFitFieldProps {
  itemId: string;
  value: FitRating | null;
  onChange: (value: FitRating | null) => void;
}

function optionClasses(selected: boolean): string {
  return `cursor-pointer rounded-control border px-3 py-1.5 text-body-sm transition-colors ${
    selected
      ? 'border-primary bg-primary/10 text-primary'
      : 'border-border text-text-secondary hover:border-border-strong'
  }`;
}

export default function ReviewFitField({ itemId, value, onChange }: ReviewFitFieldProps) {
  const name = `fit-${itemId}`;

  return (
    <fieldset>
      <legend className="mb-1 text-body-sm font-medium text-text-primary">
        How did it fit? <span className="text-text-secondary">(optional)</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        <label className={optionClasses(value === null)}>
          <input
            type="radio"
            name={name}
            value=""
            checked={value === null}
            onChange={() => onChange(null)}
            className="sr-only"
          />
          Skip
        </label>
        {OPTIONS.map((option) => (
          <label key={option} className={optionClasses(value === option)}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {fitLabel(option)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
