/**
 * Margin arithmetic.
 *
 * The rule that matters most: cost is optional, and a variant with no cost is
 * *unknown*, not free. Counting an uncosted line's revenue as pure profit would
 * be the single most misleading thing this module could do — it would make the
 * least-understood products look like the best ones.
 */
import { describe, it, expect } from 'vitest';
import {
  marginTotals,
  unitMargin,
  unitMarginPercent,
  isBelowCost,
  marginTone,
  formatMarginPercent,
} from './margin';

describe('marginTotals', () => {
  it('computes margin over lines with a known cost', () => {
    const totals = marginTotals([
      { price: 1000, quantity: 2, cost: 600 },
      { price: 500, quantity: 1, cost: 300 },
    ]);

    expect(totals.revenue).toBe(2500);
    expect(totals.cost).toBe(1500);
    expect(totals.grossMargin).toBe(1000);
    expect(totals.marginPercent).toBe(40);
    expect(totals.coveragePercent).toBe(100);
  });

  it('never treats a missing cost as zero', () => {
    // The whole point. With cost=null counted as 0, grossMargin would be 1000
    // and the margin 100% — a line nobody has costed would look perfect.
    const totals = marginTotals([{ price: 1000, quantity: 1, cost: null }]);

    expect(totals.revenue).toBe(1000);
    expect(totals.cost).toBe(0);
    expect(totals.grossMargin).toBe(0);
    expect(totals.marginPercent).toBeNull();
    expect(totals.uncostedRevenue).toBe(1000);
    expect(totals.coveragePercent).toBe(0);
  });

  it('reports margin as a share of costed revenue only', () => {
    // Half the revenue has a cost. The percentage must describe that half, not
    // be diluted by revenue it knows nothing about.
    const totals = marginTotals([
      { price: 1000, quantity: 1, cost: 400 },
      { price: 1000, quantity: 1, cost: null },
    ]);

    expect(totals.revenue).toBe(2000);
    expect(totals.costedRevenue).toBe(1000);
    expect(totals.grossMargin).toBe(600);
    expect(totals.marginPercent).toBe(60);
    expect(totals.coveragePercent).toBe(50);
  });

  it('reports a negative margin when sold below cost', () => {
    const totals = marginTotals([{ price: 400, quantity: 2, cost: 500 }]);
    expect(totals.grossMargin).toBe(-200);
    expect(totals.marginPercent).toBe(-25);
  });

  it('multiplies by quantity', () => {
    const totals = marginTotals([{ price: 100, quantity: 10, cost: 60 }]);
    expect(totals.revenue).toBe(1000);
    expect(totals.grossMargin).toBe(400);
  });

  it('handles a zero-cost line, which is different from no cost', () => {
    // A genuinely free item (a gift) is 100% margin, and that is correct.
    const totals = marginTotals([{ price: 500, quantity: 1, cost: 0 }]);
    expect(totals.marginPercent).toBe(100);
    expect(totals.coveragePercent).toBe(100);
  });

  it('returns zeroed totals for no lines', () => {
    const totals = marginTotals([]);
    expect(totals.revenue).toBe(0);
    expect(totals.marginPercent).toBeNull();
    expect(totals.coveragePercent).toBe(0);
  });

  it('survives junk numbers without producing NaN', () => {
    const totals = marginTotals([
      { price: NaN, quantity: 1, cost: 10 },
      { price: 100, quantity: Infinity, cost: 10 },
      { price: 100, quantity: 1, cost: NaN },
    ]);
    expect(Number.isFinite(totals.revenue)).toBe(true);
    expect(Number.isFinite(totals.grossMargin)).toBe(true);
  });
});

describe('unitMargin and unitMarginPercent', () => {
  it('computes both when the cost is known', () => {
    expect(unitMargin(1000, 600)).toBe(400);
    expect(unitMarginPercent(1000, 600)).toBe(40);
  });

  it('is null when the cost is unknown', () => {
    expect(unitMargin(1000, null)).toBeNull();
    expect(unitMargin(1000, undefined)).toBeNull();
    expect(unitMarginPercent(1000, null)).toBeNull();
  });

  it('is null rather than infinite for a zero price', () => {
    // A giveaway has no meaningful margin percentage.
    expect(unitMarginPercent(0, 500)).toBeNull();
    expect(unitMargin(0, 500)).toBe(-500);
  });

  it('goes negative below cost', () => {
    expect(unitMargin(400, 500)).toBe(-100);
    expect(unitMarginPercent(400, 500)).toBe(-25);
  });
});

describe('isBelowCost', () => {
  it('is true only when the cost is known and higher', () => {
    expect(isBelowCost(400, 500)).toBe(true);
    expect(isBelowCost(500, 500)).toBe(false);
    expect(isBelowCost(600, 500)).toBe(false);
  });

  it('is false when the cost is unknown, because that is not a loss', () => {
    expect(isBelowCost(400, null)).toBe(false);
    expect(isBelowCost(400, undefined)).toBe(false);
  });
});

describe('marginTone and formatMarginPercent', () => {
  it('flags a loss, a thin margin and a healthy one differently', () => {
    expect(marginTone(-5)).toBe('destructive');
    expect(marginTone(0)).toBe('warning');
    expect(marginTone(14.9)).toBe('warning');
    expect(marginTone(15)).toBe('success');
    expect(marginTone(60)).toBe('success');
  });

  it('is neutral, never green, when the margin is unknown', () => {
    expect(marginTone(null)).toBe('neutral');
  });

  it('formats to one decimal, and a dash when unknown', () => {
    expect(formatMarginPercent(40)).toBe('40.0%');
    expect(formatMarginPercent(33.333)).toBe('33.3%');
    expect(formatMarginPercent(null)).toBe('—');
  });
});
