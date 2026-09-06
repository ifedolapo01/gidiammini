/**
 * The size run.
 *
 * The case that matters most is the trap in the middle: a size that sold the
 * most units can still be the one to buy *less* of, if it sold them off a
 * mountain of stock. A report that ranks by units sold recommends the opposite
 * of the right thing, confidently.
 */
import { describe, it, expect } from 'vitest';
import { sizeInsights, type SizeFacts } from './size-demand';

const facts = (over: Partial<SizeFacts> & { size: string }): SizeFacts => ({
  soldUnits: 0,
  stockUnits: 0,
  soldOutCount: 0,
  variantCount: 1,
  ...over,
});

describe('sizeInsights', () => {
  it('tells the shop to buy more of what sells through fastest', () => {
    const [top] = sizeInsights([
      // 50 of 70 shifted (71%) against 50 of 130 (38%).
      facts({ size: '6-12m', soldUnits: 50, stockUnits: 20, soldOutCount: 4 }),
      facts({ size: 'newborn', soldUnits: 50, stockUnits: 80 }),
    ]);

    expect(top.size).toBe('6-12m');
    expect(top.verdict).toBe('buy_more');
    expect(top.sellThrough).toBeCloseTo(50 / 70, 5);
    // Mean of the two rates is the baseline.
    expect(top.demandIndex).toBeCloseTo((50 / 70) / (((50 / 70) + (50 / 130)) / 2), 5);
    expect(top.recommendation).toContain('Buy more 6-12m');
    expect(top.recommendation).toContain('sold out 4 times');
  });

  it('does not mistake the biggest seller for the best seller', () => {
    // newborn sells nine times the units and is still the one to stop buying.
    // This is the case a demand-share / stock-share ratio gets wrong: newborn
    // holds 98.8% of the stock, which pins that ratio at 0.91 and reads as
    // "about right" about the size burying the shop.
    const insights = sizeInsights([
      facts({ size: 'newborn', soldUnits: 90, stockUnits: 400 }),
      facts({ size: '6-12m', soldUnits: 10, stockUnits: 5 }),
    ]);

    const newborn = insights.find((i) => i.size === 'newborn')!;
    const older = insights.find((i) => i.size === '6-12m')!;

    expect(newborn.soldUnits).toBeGreaterThan(older.soldUnits);
    expect(newborn.verdict).toBe('buy_less');
    expect(older.verdict).toBe('buy_more');
  });

  it('calls a size stocked in proportion balanced', () => {
    const insights = sizeInsights([
      facts({ size: 'a', soldUnits: 50, stockUnits: 50 }),
      facts({ size: 'b', soldUnits: 50, stockUnits: 50 }),
    ]);

    expect(insights.every((i) => i.verdict === 'balanced')).toBe(true);
  });

  it('withholds a verdict on too few sales', () => {
    // Two units is one customer, not a demand signal — however extreme the
    // ratio looks.
    const [only] = sizeInsights([facts({ size: 'xxl', soldUnits: 2, stockUnits: 1 })]);

    expect(only.verdict).toBe('unknown');
    expect(only.recommendation).toContain('Not enough sales');
  });

  it('ranks the worst mis-buys first, in both directions', () => {
    const insights = sizeInsights([
      facts({ size: 'balanced', soldUnits: 100, stockUnits: 100 }),
      facts({ size: 'over', soldUnits: 20, stockUnits: 300 }),
      facts({ size: 'under', soldUnits: 80, stockUnits: 10 }),
    ]);

    // Both extremes outrank the size that is fine; a sort by index alone would
    // have buried one of them.
    expect(insights[2].size).toBe('balanced');
    expect(insights.slice(0, 2).map((i) => i.size).sort()).toEqual(['over', 'under']);
    expect(insights.find((i) => i.size === 'over')!.verdict).toBe('buy_less');
    expect(insights.find((i) => i.size === 'under')!.verdict).toBe('buy_more');
  });

  it('gives no verdict when there is only one size to compare', () => {
    // Against itself every size scores exactly 1.0, which would be a verdict
    // invented out of nothing.
    const [only] = sizeInsights([facts({ size: 'gone', soldUnits: 40, stockUnits: 0, soldOutCount: 6 })]);

    expect(only.demandIndex).toBeNull();
    expect(only.verdict).toBe('unknown');
  });

  it('ranks a size that sold out top rather than dropping it', () => {
    // Nothing left means it shifted 100% of what it had — the strongest
    // possible signal, and one an index built on stock share cannot express
    // at all because the denominator is zero.
    const insights = sizeInsights([
      facts({ size: 'gone', soldUnits: 40, stockUnits: 0, soldOutCount: 6 }),
      facts({ size: 'plenty', soldUnits: 10, stockUnits: 200 }),
    ]);

    expect(insights[0].size).toBe('gone');
    expect(insights[0].sellThrough).toBe(1);
    expect(insights[0].verdict).toBe('buy_more');
  });

  it('survives an empty catalogue', () => {
    expect(sizeInsights([])).toEqual([]);
  });
});
