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
import { Button, Input, Select } from '@/components/ui';
import { recommendSize, shouldOfferSizeRecommendation, type SizeRecommendation } from '@/lib/commerce/size-recommendation';
import type { ProductSizing } from '@/lib/commerce/size-guide';

interface SizeRecommenderProps {
  product: ProductSizing;
  onSelectSize: (size: string) => void;
}

type HeightUnit = 'cm' | 'in';
type WeightUnit = 'kg' | 'lb';

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;

/** Parses a form field into a positive number, or undefined for blank/invalid
 *  input. */
function toPositiveNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** No match found is a different problem from no input given — one says
 *  "tell us something", the other says "what you told us doesn't land on
 *  anything we stock". Collapsing them into one message blames the customer
 *  for a gap that's actually in the catalogue's sizing. */
type RecommendationResult = SizeRecommendation | { kind: 'no_input' } | { kind: 'no_match' };

export default function SizeRecommender({ product, onSelectSize }: SizeRecommenderProps) {
  const [open, setOpen] = useState(false);
  const [ageMonths, setAgeMonths] = useState('');
  const [heightValue, setHeightValue] = useState('');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [weightValue, setWeightValue] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [result, setResult] = useState<RecommendationResult | null>(null);

  if (!shouldOfferSizeRecommendation(product)) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const age = toPositiveNumber(ageMonths);
    const height = toPositiveNumber(heightValue);
    const weight = toPositiveNumber(weightValue);

    if (age === undefined && height === undefined) {
      setResult({ kind: 'no_input' });
      return;
    }

    const recommendation = recommendSize(product, {
      ageMonths: age,
      heightCm: height === undefined ? undefined : heightUnit === 'in' ? height * CM_PER_INCH : height,
      weightKg: weight === undefined ? undefined : weightUnit === 'lb' ? weight * KG_PER_LB : weight,
    });
    setResult(recommendation ?? { kind: 'no_match' });
  }

  function useRecommendation() {
    if (result && 'recommendedSize' in result) onSelectSize(result.recommendedSize);
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
        <div className="absolute right-0 top-full z-10 mt-2 w-80 rounded-surface border border-border bg-surface p-4 shadow-lg">
          <p className="mb-3 text-body-sm text-text-secondary">
            Enter age, or height and weight, whichever you have.
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
                Height
                <div className="mt-1 flex gap-1">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    size="sm"
                    className="min-w-0 flex-1"
                    value={heightValue}
                    onChange={(event) => setHeightValue(event.target.value)}
                  />
                  <Select
                    size="sm"
                    className="w-16 shrink-0 pl-2 pr-6"
                    aria-label="Height unit"
                    value={heightUnit}
                    onChange={(event) => setHeightUnit(event.target.value as HeightUnit)}
                  >
                    <option value="cm">cm</option>
                    <option value="in">in</option>
                  </Select>
                </div>
              </label>
              <label className="block text-caption-md font-medium text-text-secondary">
                Weight
                <div className="mt-1 flex gap-1">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    size="sm"
                    className="min-w-0 flex-1"
                    value={weightValue}
                    onChange={(event) => setWeightValue(event.target.value)}
                  />
                  <Select
                    size="sm"
                    className="w-16 shrink-0 pl-2 pr-6"
                    aria-label="Weight unit"
                    value={weightUnit}
                    onChange={(event) => setWeightUnit(event.target.value as WeightUnit)}
                  >
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </Select>
                </div>
              </label>
            </div>
            <Button type="submit" size="sm" className="mt-1 w-full">
              Get recommendation
            </Button>
          </form>

          {result && 'kind' in result && result.kind === 'no_input' && (
            <p className="mt-3 text-body-sm text-destructive">
              Enter an age, or a height, to get a recommendation.
            </p>
          )}
          {result && 'kind' in result && result.kind === 'no_match' && (
            <p className="mt-3 text-body-sm text-destructive">
              That doesn&apos;t match a size we stock for this product. Try the size guide instead.
            </p>
          )}
          {result && 'recommendedSize' in result && (
            <div className="mt-3 rounded-control bg-background-secondary p-2.5 text-body-sm text-text-primary">
              <p>
                We&apos;d suggest <strong>{result.recommendedSize}</strong>
                {!result.exactMatch && ', the closest size we stock'}.
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
