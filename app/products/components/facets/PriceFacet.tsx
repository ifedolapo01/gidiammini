/**
 * STOREFRONT layer — the price facet, as bands rather than two number inputs.
 *
 * Radio semantics: the bands are mutually exclusive, and a shopper on a budget
 * is answering one question ("what can I spend?"), not composing a set. Native
 * radios rather than styled buttons, so arrow keys move between them and the
 * group reads as one control.
 *
 * The bands come from the catalogue's own price range — see price-bands.ts for
 * why a hardcoded ladder goes wrong at both ends.
 */
'use client';

import { useId } from 'react';
import { buildPriceBands, matchPriceBand } from '@/lib/commerce/price-bands';
import FacetSection from './FacetSection';

interface PriceFacetProps {
  minPrice: number;
  maxPrice: number;
  selectedMin: number | null;
  selectedMax: number | null;
  onSelect: (min: number | null, max: number | null) => void;
}

const OPTION_CLASS =
  'flex cursor-pointer items-center gap-2 rounded-control py-0.5 text-body-sm text-text-primary hover:text-primary';

const RADIO_CLASS =
  'size-4 accent-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus';

export default function PriceFacet({
  minPrice,
  maxPrice,
  selectedMin,
  selectedMax,
  onSelect,
}: PriceFacetProps) {
  const groupName = useId();
  const bands = buildPriceBands(minPrice, maxPrice);

  // A catalogue where everything costs about the same offers no choice here,
  // and a facet with one option is furniture.
  if (bands.length === 0) return null;

  const active = matchPriceBand(bands, selectedMin, selectedMax);
  const hasSelection = selectedMin !== null || selectedMax !== null;

  return (
    <FacetSection title="Price" badge={hasSelection ? 1 : 0}>
      <div className="space-y-2" role="radiogroup" aria-label="Price">
        <label className={OPTION_CLASS}>
          <input
            type="radio"
            name={groupName}
            className={RADIO_CLASS}
            checked={!hasSelection}
            onChange={() => onSelect(null, null)}
          />
          <span>Any price</span>
        </label>

        {bands.map((band) => (
          <label key={band.id} className={OPTION_CLASS}>
            <input
              type="radio"
              name={groupName}
              className={RADIO_CLASS}
              checked={active?.id === band.id}
              onChange={() => onSelect(band.min, band.max)}
            />
            <span>{band.label}</span>
          </label>
        ))}
      </div>
    </FacetSection>
  );
}
