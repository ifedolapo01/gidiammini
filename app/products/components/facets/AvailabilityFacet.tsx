/**
 * STOREFRONT layer — the two boolean facets: on sale, and in stock only.
 *
 * The listing now shows sold-out products by default, dimmed and ranked last,
 * so this reads the way round it always should have: both boxes start unticked,
 * and ticking either one narrows what you see. A checkbox ticked by default to
 * mean "show me less" was the wrong shape.
 *
 * This is the setter the old hook's `showOutOfStock` never had.
 */
'use client';

import { useId } from 'react';
import { Checkbox } from '@/components/ui';
import FacetSection from './FacetSection';

interface AvailabilityFacetProps {
  onSale: boolean;
  inStockOnly: boolean;
  onChange: (change: { onSale?: boolean; inStockOnly?: boolean }) => void;
}

const OPTION_CLASS =
  'flex cursor-pointer items-center gap-2 rounded-control py-0.5 text-body-sm text-text-primary hover:text-primary';

export default function AvailabilityFacet({ onSale, inStockOnly, onChange }: AvailabilityFacetProps) {
  const saleId = useId();
  const stockId = useId();

  return (
    <FacetSection title="Availability" badge={(onSale ? 1 : 0) + (inStockOnly ? 1 : 0)}>
      <div className="space-y-2">
        <label htmlFor={saleId} className={OPTION_CLASS}>
          <Checkbox
            id={saleId}
            checked={onSale}
            onChange={(event) => onChange({ onSale: event.target.checked })}
          />
          <span>On sale</span>
        </label>

        <label htmlFor={stockId} className={OPTION_CLASS}>
          <Checkbox
            id={stockId}
            checked={inStockOnly}
            onChange={(event) => onChange({ inStockOnly: event.target.checked })}
          />
          <span>In stock only</span>
        </label>
      </div>
    </FacetSection>
  );
}
