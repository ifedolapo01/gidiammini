/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { Discount, formatDiscountValue } from '@/lib/commerce/discounts';

interface ProductPriceDisplayProps {
  bestDiscount: Discount | null;
  finalPrice: number;
  currentBasePrice: number;
}

export default function ProductPriceDisplay({ bestDiscount, finalPrice, currentBasePrice }: ProductPriceDisplayProps) {
  return (
    <div className="mb-6 md:mb-8 flex items-end gap-3">
      {bestDiscount ? (
        <>
          <div className="text-h3 md:text-h2 font-bold text-destructive">
            {formatCurrency(finalPrice)}
          </div>
          <div className="text-h5 text-text-muted line-through mb-1">
            {formatCurrency(currentBasePrice)}
          </div>
          <Badge tone="destructive" variant="subtle" className="font-bold mb-1">
            {formatDiscountValue(bestDiscount, 'save')}
          </Badge>
        </>
      ) : (
        <div className="text-h3 md:text-h2 font-bold text-text-primary">
          {formatCurrency(currentBasePrice)}
        </div>
      )}
    </div>
  );
}
