/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { formatCurrency } from '@/lib/commerce/pricing';

interface MobileOrderSummaryProps {
  total: number;
  /** Opens the full order-summary modal (mobile "View Details" tap target). */
  onViewDetails: () => void;
}

export default function MobileOrderSummary({ total, onViewDetails }: MobileOrderSummaryProps) {
  return (
    <div className="flex justify-between items-center mb-3 sm:mb-4">
      <div>
        <p className="text-caption-md sm:text-body-sm text-text-secondary">Total Amount</p>
        <p className="font-bold text-body-lg sm:text-h5 text-primary">{formatCurrency(total)}</p>
      </div>
      <div className="text-right">
        <p className="text-caption-md text-text-secondary">Includes tax & shipping</p>
        <button
          type="button"
          onClick={onViewDetails}
          className="text-caption-md sm:text-body-sm text-primary font-medium mt-1"
        >
          View Details
        </button>
      </div>
    </div>
  );
}
