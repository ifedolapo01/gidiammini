import { describe, it, expect } from 'vitest';
import { adjustPricing, isValidPercent, describePercent } from './price-adjust';

describe('adjustPricing', () => {
  it('marks a simple product down', () => {
    expect(adjustPricing({ price: 10000, variants: [] }, -30)).toEqual({ price: 7000, variants: [] });
  });

  it('marks a simple product up', () => {
    expect(adjustPricing({ price: 10000, variants: [] }, 10).price).toBe(11000);
  });

  it('rounds to whole minor units, because both price columns are integers', () => {
    expect(adjustPricing({ price: 999, variants: [] }, -33).price).toBe(669);
  });

  it('never produces a negative price', () => {
    expect(adjustPricing({ price: 500, variants: [] }, -99).price).toBe(5);
  });

  it('moves every variant price, not just the product price', () => {
    // Writing products.price alone looks right until the storefront reads the
    // per-variant price product_variants actually charges.
    const variants = [
      { variantKey: '0-3 months|red', price: 5000 },
      { variantKey: '3-6 months|blue', price: 6000 },
    ];

    const result = adjustPricing({ price: 5000, variants }, -50);

    expect(result.price).toBe(2500);
    expect(result.variants).toEqual([
      { variantKey: '0-3 months|red', price: 2500 },
      { variantKey: '3-6 months|blue', price: 3000 },
    ]);
  });

  it('does not mutate the variants array it was given', () => {
    const variants = [{ variantKey: 's', price: 1000 }];
    adjustPricing({ price: 1000, variants }, -10);
    expect(variants).toEqual([{ variantKey: 's', price: 1000 }]);
  });
});

describe('isValidPercent', () => {
  it('accepts a markdown and an increase', () => {
    expect(isValidPercent(-30)).toBe(true);
    expect(isValidPercent(15)).toBe(true);
  });

  it('rejects values that mean nothing or cannot be priced', () => {
    // -100 would be free, below that would be negative, and 0 is a no-op that
    // would still write every row and fill the audit trail.
    expect(isValidPercent(0)).toBe(false);
    expect(isValidPercent(-100)).toBe(false);
    expect(isValidPercent(-150)).toBe(false);
    expect(isValidPercent(Number.NaN)).toBe(false);
    expect(isValidPercent('30' as unknown)).toBe(false);
  });
});

describe('describePercent', () => {
  it('says which direction the change goes', () => {
    expect(describePercent(-30)).toBe('30% off');
    expect(describePercent(10)).toBe('10% increase');
  });
});
