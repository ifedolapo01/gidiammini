/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// "Recommend my size", next to the size guide rather than instead of it.
//
// Renders nothing on its own for a chart the questionnaire can't answer
// (letter, maternity — see shouldOfferSizeRecommendation) rather than the
// parent deciding that upstream, so this stays the one place that knows
// which charts the form applies to.
'use client';

import { useState, type FormEvent } from 'react';
import { Wand2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { recommendSize, shouldOfferSizeRecommendation, type SizeRecommendation } from '@/lib/commerce/size-recommendation';
import type { ProductSizing } from '@/lib/commerce/size-guide';

interface SizeRecommenderProps {
  product: ProductSizing;
  onSelectSize: (size: string) => void;
}

/** Parses a form field into a positive number, or undefined for blank/invalid
 *  input — recommendSize treats "not answered" and "can't parse" the same. */
function toPositiveNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export default function SizeRecommender({ product, onSelectSize }: SizeRecommenderProps) {
  const [open, setOpen] = useState(false);
  const [ageMonths, setAgeMonths] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [result, setResult] = useState<SizeRecommendation | 'unanswered' | null>(null);

  if (!shouldOfferSizeRecommendation(product)) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const recommendation = recommendSize(product, {
      ageMonths: toPositiveNumber(ageMonths),
      heightCm: toPositiveNumber(heightCm),
      weightKg: toPositiveNumber(weightKg),
    });
    setResult(recommendation ?? 'unanswered');
  }

  function useRecommendation() {
    if (result && result !== 'unanswered') onSelectSize(result.recommendedSize);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-control px-1 py-1 text-body-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
      >
        <Wand2 className="h-4 w-4" aria-hidden="true" />
        Recommend my size
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-2 w-72 rounded-surface border border-border bg-surface p-4 shadow-lg">
          <p className="mb-3 text-body-sm text-text-secondary">
            Enter age, or height and weight — whichever you have.
          </p>
          <form onSubmit={handleSubmit} className="space-y-2">
            <label className="block text-caption-md font-medium text-text-secondary">
              Age (months)
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                size="sm"
                className="mt-1"
                value={ageMonths}
                onChange={(event) => setAgeMonths(event.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-caption-md font-medium text-text-secondary">
                Height (cm)
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  size="sm"
                  className="mt-1"
                  value={heightCm}
                  onChange={(event) => setHeightCm(event.target.value)}
                />
              </label>
              <label className="block text-caption-md font-medium text-text-secondary">
                Weight (kg)
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  size="sm"
                  className="mt-1"
                  value={weightKg}
                  onChange={(event) => setWeightKg(event.target.value)}
                />
              </label>
            </div>
            <Button type="submit" size="sm" className="mt-1 w-full">
              Get recommendation
            </Button>
          </form>

          {result === 'unanswered' && (
            <p className="mt-3 text-body-sm text-destructive">
              Enter an age, or a height, to get a recommendation.
            </p>
          )}
          {result && result !== 'unanswered' && (
            <div className="mt-3 rounded-control bg-background-secondary p-2.5 text-body-sm text-text-primary">
              <p>
                We&apos;d suggest <strong>{result.recommendedSize}</strong>
                {!result.exactMatch && ' — the closest size we stock'}.
              </p>
              <Button type="button" variant="link" size="sm" className="mt-1" onClick={useRecommendation}>
                Use this size
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
