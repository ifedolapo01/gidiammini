/** ADMIN layer — a discount's identity in the table: name, value, and how a
 *  customer gets it.
 *
 * Split from DiscountTable.tsx when codes arrived. "Applies automatically"
 * versus a code chip is the single most important thing about a row — it is
 * the difference between a discount everybody gets and one only an
 * influencer's followers do — and it deserves to be read on its own rather
 * than found inside a two-hundred-line table.
 */
'use client';

import { Percent } from 'lucide-react';
import { Discount, formatDiscountValue, requiresCode } from '@/lib/commerce/discounts';
import { formatCurrency } from '@/lib/commerce/pricing';

/** The tile beside the name. Free delivery is neither a percentage nor a naira
 *  amount, so it gets its own mark rather than defaulting to one of them. */
function TypeTile({ discount }: { discount: Discount }) {
  if (discount.type === 'FREE_SHIPPING') {
    return (
      <div className="w-10 h-10 rounded-control flex items-center justify-center bg-info-background text-info">
        <span className="font-bold text-caption-md">FREE</span>
      </div>
    );
  }

  const percentage = discount.type === 'PERCENTAGE';

  return (
    <div
      className={`w-10 h-10 rounded-control flex items-center justify-center ${
        percentage ? 'bg-accent/10 text-accent' : 'bg-success-background text-success'
      }`}
    >
      {percentage ? <Percent size={20} /> : <span className="font-bold">&#8358;</span>}
    </div>
  );
}

export default function DiscountNameCell({ discount }: { discount: Discount }) {
  return (
    <div className="flex items-center gap-3">
      <TypeTile discount={discount} />
      <div>
        <p className="font-bold text-text-primary">{discount.name}</p>
        <p className="text-body-sm text-text-secondary font-medium">
          {formatDiscountValue(discount)}
        </p>

        {requiresCode(discount) ? (
          <p className="mt-1 inline-block rounded border border-border bg-background-secondary px-1.5 py-0.5 font-mono text-caption-md text-text-primary">
            {discount.code}
            {typeof discount.max_redemptions === 'number' && (
              <span className="ml-1 font-sans text-text-secondary">
                {discount.redemption_count ?? 0}/{discount.max_redemptions}
              </span>
            )}
          </p>
        ) : (
          <p className="mt-1 text-caption-md text-text-muted">Applies automatically</p>
        )}

        {typeof discount.min_order_value === 'number' && discount.min_order_value > 0 && (
          <p className="text-caption-md text-text-muted">
            Baskets over {formatCurrency(discount.min_order_value)}
          </p>
        )}
      </div>
    </div>
  );
}
