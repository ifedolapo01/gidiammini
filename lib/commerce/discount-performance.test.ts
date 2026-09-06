/**
 * What a discount earned and cost.
 *
 * The cases worth pinning are the ones where a wrong default flatters a
 * campaign: a missing cost price silently becoming zero (which would report
 * pure profit), and a missing base price silently becoming zero (which would
 * report that the discount gave nothing away).
 */
import { describe, it, expect } from 'vitest';
import { summarisePerformance, type DiscountLineFacts } from './discount-performance';

const line = (over: Partial<DiscountLineFacts> = {}): DiscountLineFacts => ({
  price: 8_000,
  basePrice: 10_000,
  quantity: 1,
  cost: 5_000,
  ...over,
});

describe('summarisePerformance', () => {
  it('adds up revenue, units and what was given away', () => {
    const result = summarisePerformance([line({ quantity: 2 }), line()], 2);

    expect(result.orders).toBe(2);
    expect(result.unitsSold).toBe(3);
    expect(result.revenue).toBe(24_000);
    // 2,000 off each of three units.
    expect(result.discountGiven).toBe(6_000);
    expect(result.margin).toBe(24_000 - 15_000);
    expect(result.marginCoverage).toBe(1);
  });

  it('reports a negative margin rather than hiding it', () => {
    // A campaign that sold below cost. This is the number the whole report
    // exists to surface.
    const result = summarisePerformance([line({ price: 4_000, cost: 5_000 })], 1);
    expect(result.margin).toBe(-1_000);
  });

  it('leaves margin unknown when no line records a cost', () => {
    // Not zero. Zero would read as "this campaign broke exactly even".
    const result = summarisePerformance([line({ cost: null })], 1);
    expect(result.margin).toBeNull();
    expect(result.marginCoverage).toBe(0);
  });

  it('reports how much of the revenue actually had a cost behind it', () => {
    // Half the revenue is uncosted, so the margin is a fact about half the
    // sales and the UI has to say so.
    const result = summarisePerformance([line(), line({ cost: null })], 1);
    expect(result.margin).toBe(8_000 - 5_000);
    expect(result.marginCoverage).toBeCloseTo(0.5, 5);
  });

  it('counts lines with no recorded base price instead of assuming none', () => {
    // Rows that predate the column. Treating a null base price as 0 would make
    // discountGiven negative, or as equal to price would make it zero — both
    // understate what past campaigns cost.
    const result = summarisePerformance([line({ basePrice: null }), line()], 1);
    expect(result.linesWithoutBasePrice).toBe(1);
    expect(result.discountGiven).toBe(2_000);
  });

  it('never counts a line sold above catalogue as a negative discount', () => {
    const result = summarisePerformance([line({ price: 12_000, basePrice: 10_000 })], 1);
    expect(result.discountGiven).toBe(0);
  });

  it('reports a discount nobody used as zeroes, with its order count', () => {
    const result = summarisePerformance([], 0);
    expect(result).toMatchObject({ orders: 0, revenue: 0, margin: null });
  });
});
