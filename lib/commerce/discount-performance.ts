/**
 * COMMERCE layer — what a discount earned and what it cost. Pure.
 *
 * The question the discounts page has never been able to answer: after a sale
 * ends, did it make money or did it hand a markdown to people who were going
 * to buy anyway?
 *
 * WHAT THIS CAN AND CANNOT SAY
 *
 * It reports what was charged, what was given away, and the margin left — all
 * from rows written at the time of sale. It does not claim any of that revenue
 * was *caused* by the discount, and no arithmetic over this data could: a shop
 * cannot observe the order somebody would have placed at full price. So the
 * label in the UI is "revenue on discounted lines", not "incremental revenue",
 * and the figure a buyer should actually act on is the margin — a campaign
 * that moved a lot of stock at a loss is visible here even though its
 * counterfactual is not.
 *
 * base_price is nullable on lines that predate migration 20260906150000, and
 * those genuinely cannot say what was given away. They are counted separately
 * rather than assumed to be zero, which would understate every historical
 * campaign.
 */

export interface DiscountLineFacts {
  /** Charged per unit. */
  price: number;
  /** Catalogue price per unit before the discount. Null on lines written
   *  before the column existed. */
  basePrice: number | null;
  quantity: number;
  /** Unit cost, where the variant records one. */
  cost: number | null;
}

export interface DiscountPerformance {
  /** Orders that used this discount. */
  orders: number;
  unitsSold: number;
  /** What was actually charged on the discounted lines. */
  revenue: number;
  /** What was given away, where the line recorded a base price. */
  discountGiven: number;
  /** Gross margin on those lines: revenue less cost, over the lines that have
   *  a cost. Null when no line does. */
  margin: number | null;
  /** Share of revenue that had a cost behind it, 0-1. A margin computed over a
   *  third of the lines must not be read as the whole picture. */
  marginCoverage: number;
  /** Lines whose base price was never recorded. The discount given excludes
   *  them, so a non-zero count means that figure is a floor, not a total. */
  linesWithoutBasePrice: number;
}

export const EMPTY_PERFORMANCE: DiscountPerformance = {
  orders: 0,
  unitsSold: 0,
  revenue: 0,
  discountGiven: 0,
  margin: null,
  marginCoverage: 0,
  linesWithoutBasePrice: 0,
};

export function summarisePerformance(
  lines: DiscountLineFacts[],
  orderCount: number
): DiscountPerformance {
  if (lines.length === 0) return { ...EMPTY_PERFORMANCE, orders: orderCount };

  let unitsSold = 0;
  let revenue = 0;
  let discountGiven = 0;
  let costedRevenue = 0;
  let cost = 0;
  let linesWithoutBasePrice = 0;

  for (const line of lines) {
    const quantity = Math.max(0, line.quantity);
    const lineRevenue = line.price * quantity;

    unitsSold += quantity;
    revenue += lineRevenue;

    if (typeof line.basePrice === 'number') {
      // GREATEST-style guard: a base price below the charged price would mean
      // a line sold *above* catalogue, which is not a discount and must not
      // subtract from the total given away.
      discountGiven += Math.max(0, line.basePrice - line.price) * quantity;
    } else {
      linesWithoutBasePrice += 1;
    }

    if (typeof line.cost === 'number') {
      costedRevenue += lineRevenue;
      cost += line.cost * quantity;
    }
  }

  return {
    orders: orderCount,
    unitsSold,
    revenue,
    discountGiven,
    margin: costedRevenue > 0 ? costedRevenue - cost : null,
    marginCoverage: revenue > 0 ? costedRevenue / revenue : 0,
    linesWithoutBasePrice,
  };
}
