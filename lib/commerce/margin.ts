/**
 * COMMERCE layer — margin arithmetic.
 *
 * Revenue-only reporting hides the question that matters: which products make
 * money. A high-revenue, low-margin line looks like the best seller, and
 * discounting decisions get made blind.
 *
 * Cost is optional per variant, and that shapes everything here. A variant with
 * no cost recorded is *unknown*, not free — so it must never be counted as 100%
 * margin. Every function below distinguishes "no margin" from "margin unknown",
 * and the totals report how much of the revenue had a cost at all so a figure
 * is never read as more complete than it is.
 *
 * Pure and dependency-free.
 */

export interface MarginLine {
  /** What the customer paid, per unit, at the time of sale. */
  price: number;
  quantity: number;
  /** null when this variant has no cost recorded. */
  cost: number | null;
}

export interface MarginTotals {
  revenue: number;
  /** Cost of goods, counting only lines whose cost is known. */
  cost: number;
  /** revenue − cost, across lines with a known cost only. */
  grossMargin: number;
  /** Margin as a percentage of the revenue it was computed from, or null when
   * nothing had a cost. */
  marginPercent: number | null;
  /** Revenue from lines that had a cost. The denominator of marginPercent. */
  costedRevenue: number;
  /** Revenue from lines with no cost recorded — the blind spot. */
  uncostedRevenue: number;
  /** Share of revenue with a known cost, 0–100. 100 means the figure is complete. */
  coveragePercent: number;
}

const EMPTY: MarginTotals = {
  revenue: 0,
  cost: 0,
  grossMargin: 0,
  marginPercent: null,
  costedRevenue: 0,
  uncostedRevenue: 0,
  coveragePercent: 0,
};

function isUsableNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Totals across sold lines.
 *
 * `grossMargin` deliberately excludes uncosted lines from both sides rather
 * than treating their cost as zero. Including them would report the whole of an
 * uncosted line's revenue as profit, which is the single most misleading thing
 * this function could do.
 */
export function marginTotals(lines: MarginLine[]): MarginTotals {
  if (lines.length === 0) return { ...EMPTY };

  let revenue = 0;
  let cost = 0;
  let costedRevenue = 0;

  for (const line of lines) {
    const quantity = isUsableNumber(line.quantity) ? line.quantity : 0;
    const price = isUsableNumber(line.price) ? line.price : 0;
    const lineRevenue = price * quantity;

    revenue += lineRevenue;

    if (isUsableNumber(line.cost)) {
      cost += line.cost * quantity;
      costedRevenue += lineRevenue;
    }
  }

  const grossMargin = costedRevenue - cost;

  return {
    revenue,
    cost,
    grossMargin,
    marginPercent: costedRevenue > 0 ? (grossMargin / costedRevenue) * 100 : null,
    costedRevenue,
    uncostedRevenue: revenue - costedRevenue,
    coveragePercent: revenue > 0 ? (costedRevenue / revenue) * 100 : 0,
  };
}

/** Margin on one unit, or null when the cost is unknown. */
export function unitMargin(price: number, cost: number | null | undefined): number | null {
  if (!isUsableNumber(cost) || !isUsableNumber(price)) return null;
  return price - cost;
}

/** Margin on one unit as a percentage of its price, or null when unknowable. */
export function unitMarginPercent(price: number, cost: number | null | undefined): number | null {
  const margin = unitMargin(price, cost);
  // A price of zero has no meaningful percentage — a giveaway is not -Infinity.
  if (margin === null || !isUsableNumber(price) || price <= 0) return null;
  return (margin / price) * 100;
}

/** True only when the cost is known and the price is under it. Unknown cost is
 * not a loss, so it never trips a warning. */
export function isBelowCost(price: number, cost: number | null | undefined): boolean {
  const margin = unitMargin(price, cost);
  return margin !== null && margin < 0;
}

export type MarginTone = 'success' | 'warning' | 'destructive' | 'neutral';

/**
 * How a margin should read at a glance. The thresholds are deliberately
 * conservative for a boutique: under 15% is thin once delivery and handling
 * come out of it.
 */
export function marginTone(marginPercent: number | null): MarginTone {
  if (marginPercent === null) return 'neutral';
  if (marginPercent < 0) return 'destructive';
  if (marginPercent < 15) return 'warning';
  return 'success';
}

/** Percentage for display: one decimal, or an em dash when unknown. */
export function formatMarginPercent(marginPercent: number | null): string {
  return marginPercent === null ? '—' : `${marginPercent.toFixed(1)}%`;
}
