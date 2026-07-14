/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { formatCurrency } from '@/lib/commerce/pricing';

interface MobileOrderSummaryProps {
  total: number;
}

export default function MobileOrderSummary({ total }: MobileOrderSummaryProps) {
  return (
    <div className="flex justify-between items-center mb-4">
      <div>
        <p className="text-body-sm text-text-secondary">Total Amount</p>
        <p className="font-bold text-h5 text-primary">{formatCurrency(total)}</p>
      </div>
      <div className="text-right">
        <p className="text-body-sm text-text-secondary">Includes tax & shipping</p>
        <p className="text-caption-md text-text-muted">Tap for details</p>
      </div>
    </div>
  );
}
