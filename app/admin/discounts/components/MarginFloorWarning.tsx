/**
 * ADMIN layer — warns before a discount sells something below cost.
 *
 * Shown live as the value is typed, not on submit: the point is to change the
 * number before it is saved. It warns rather than blocks — selling a line at a
 * loss is sometimes a deliberate decision (clearing dead stock, a loss leader),
 * and a form that refuses would just get worked around.
 *
 * When nothing can be checked it says so. A green "no problems" on a catalogue
 * with no cost prices recorded would be the most misleading thing here.
 */
'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/commerce/pricing';
import { findBelowCostVariants } from '@/lib/commerce/margin-floor';
import type { Discount } from '@/lib/commerce/discounts';
import type { Product } from '@/types/product';

interface MarginFloorWarningProps {
  products: Product[];
  discount: Pick<Discount, 'type' | 'value' | 'scope' | 'target_id'>;
}

/** How many offending variants to name before summarising the rest. */
const MAX_LISTED = 5;

export default function MarginFloorWarning({ products, discount }: MarginFloorWarningProps) {
  const { below, uncheckedCount, checkedCount } = findBelowCostVariants(products, discount);

  if (below.length === 0 && checkedCount === 0 && uncheckedCount === 0) return null;

  if (below.length === 0) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-control bg-info-background border border-info-border">
        <Info className="w-4 h-4 text-info flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-caption-md text-info">
          {checkedCount === 0
            ? `No cost prices recorded for the ${uncheckedCount} variant${uncheckedCount === 1 ? '' : 's'} this affects, so margin cannot be checked.`
            : `Stays above cost on all ${checkedCount} variant${checkedCount === 1 ? '' : 's'} checked.`}
          {checkedCount > 0 && uncheckedCount > 0 &&
            ` ${uncheckedCount} more have no cost recorded and were not checked.`}
        </p>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="p-3 rounded-control bg-destructive-background border border-destructive-border"
    >
      <p className="flex items-center gap-2 text-body-sm font-bold text-destructive">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        Below cost on {below.length} variant{below.length === 1 ? '' : 's'}
      </p>

      <ul className="mt-2 space-y-1">
        {below.slice(0, MAX_LISTED).map((variant) => (
          <li key={`${variant.productId}-${variant.variantKey}`} className="text-caption-md text-destructive">
            <span className="font-medium">{variant.productName}</span>
            {variant.label !== 'Standard' && <span className="text-destructive/80"> · {variant.label}</span>}
            {': '}
            {formatCurrency(variant.discountedPrice)} vs {formatCurrency(variant.cost)} cost —
            {' '}losing {formatCurrency(variant.lossPerUnit)} per unit
          </li>
        ))}
      </ul>

      {below.length > MAX_LISTED && (
        <p className="mt-1 text-caption-md text-destructive/80">
          and {below.length - MAX_LISTED} more.
        </p>
      )}

      {uncheckedCount > 0 && (
        <p className="mt-2 text-caption-md text-destructive/80">
          {uncheckedCount} further variant{uncheckedCount === 1 ? '' : 's'} have no cost recorded and could not be checked.
        </p>
      )}
    </div>
  );
}
