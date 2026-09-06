/** ADMIN layer — what one discount earned, in a table cell.
 *
 * Three numbers, in the order a shopkeeper asks them: how many orders used it,
 * what those orders were worth, and what was left after cost. The amount given
 * away sits under the revenue because it is the price of that revenue.
 *
 * MARGIN IS THE FIGURE, NOT REVENUE
 *
 * Revenue on discounted lines always looks good — that is what a discount
 * does. Margin is the one that can be negative, so it is the one shown in
 * colour, and it is qualified when only part of the catalogue records a cost.
 * A margin computed over a third of the lines presented as a flat number is
 * how a campaign gets called a success.
 */
'use client';

import { formatCurrency } from '@/lib/commerce/pricing';
import type { DiscountPerformance } from '@/lib/commerce/discount-performance';

interface Props {
  performance?: DiscountPerformance;
  /** True while the second request is still out, or when it could not be
   *  read at all. Different from a discount nobody has used. */
  unavailable?: boolean;
}

export default function DiscountPerformanceCell({ performance, unavailable }: Props) {
  if (unavailable) {
    return <span className="text-caption-md text-text-muted">—</span>;
  }

  if (!performance || performance.orders === 0) {
    return <span className="text-caption-md text-text-secondary">Not used yet</span>;
  }

  const { orders, unitsSold, revenue, discountGiven, margin, marginCoverage, linesWithoutBasePrice } =
    performance;

  // Below this, the margin is a fact about a minority of the lines. Saying so
  // costs a few words; not saying so costs a buying decision.
  const partialCost = marginCoverage > 0 && marginCoverage < 0.9;

  return (
    <div className="text-caption-md leading-relaxed">
      <p className="font-medium text-text-primary">
        {orders} order{orders === 1 ? '' : 's'}
        <span className="font-normal text-text-secondary"> · {unitsSold} units</span>
      </p>

      <p className="text-text-secondary">
        {formatCurrency(revenue)} revenue
        {discountGiven > 0 && <> · {formatCurrency(discountGiven)} given</>}
      </p>

      {margin === null ? (
        <p className="text-text-muted" title="No cost price recorded on any of these variants">
          Margin unknown
        </p>
      ) : (
        <p className={margin < 0 ? 'text-destructive font-medium' : 'text-success'}>
          {formatCurrency(margin)} margin
          {partialCost && (
            <span
              className="text-text-muted"
              title={`Only ${Math.round(marginCoverage * 100)}% of this revenue has a cost price recorded`}
            >
              {' '}
              ({Math.round(marginCoverage * 100)}% costed)
            </span>
          )}
        </p>
      )}

      {linesWithoutBasePrice > 0 && (
        <p
          className="text-text-muted"
          title="These lines were sold before the shop started recording the pre-discount price, so the amount given away is a floor rather than a total"
        >
          {linesWithoutBasePrice} line{linesWithoutBasePrice === 1 ? '' : 's'} pre-date tracking
        </p>
      )}
    </div>
  );
}
