/**
 * Discount selection and rounding decide what a customer is charged. These are
 * now the server's numbers too — priceOrder() calls straight into them
 * (lib/commerce/price-order.ts), so a mistake here is a mispriced order, not
 * just a wrong label.
 */
import { describe, it, expect } from 'vitest';
import {
  getBestDiscount, calculateSavings, calculateDiscountedPrice, formatDiscountValue,
  type Discount,
} from './discounts';

const base = (over: Partial<Discount> = {}): Discount => ({
  id: 'd1', name: 'Test', type: 'PERCENTAGE', value: 10, scope: 'SITEWIDE',
  target_id: null, is_active: true, start_date: null, end_date: null, ...over,
});

const product = { id: 'p1', category: 'babies', sub_category: 'babies-tops', price: 10000 };

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const DAY = 86_400_000;

describe('getBestDiscount — eligibility', () => {
  it('returns null when there are no discounts', () => {
    expect(getBestDiscount(product, [])).toBeNull();
    expect(getBestDiscount(product, undefined as any)).toBeNull();
  });

  it('ignores inactive discounts', () => {
    expect(getBestDiscount(product, [base({ is_active: false })])).toBeNull();
  });

  it('ignores a discount that has not started', () => {
    expect(getBestDiscount(product, [base({ start_date: iso(DAY) })])).toBeNull();
  });

  it('ignores a discount that has expired', () => {
    expect(getBestDiscount(product, [base({ end_date: iso(-DAY) })])).toBeNull();
  });

  it('accepts a discount inside its window', () => {
    const d = base({ start_date: iso(-DAY), end_date: iso(DAY) });
    expect(getBestDiscount(product, [d])?.id).toBe('d1');
  });
});

describe('getBestDiscount — scope matching', () => {
  it('matches SITEWIDE', () => {
    expect(getBestDiscount(product, [base()])?.id).toBe('d1');
  });

  it('matches CATEGORY only on the right category', () => {
    expect(getBestDiscount(product, [base({ scope: 'CATEGORY', target_id: 'babies' })])?.id).toBe('d1');
    expect(getBestDiscount(product, [base({ scope: 'CATEGORY', target_id: 'kids' })])).toBeNull();
  });

  it('matches SUBCATEGORY only on the right subcategory', () => {
    expect(getBestDiscount(product, [base({ scope: 'SUBCATEGORY', target_id: 'babies-tops' })])?.id).toBe('d1');
    expect(getBestDiscount(product, [base({ scope: 'SUBCATEGORY', target_id: 'babies-pants' })])).toBeNull();
  });

  it('matches PRODUCT only on the right product', () => {
    expect(getBestDiscount(product, [base({ scope: 'PRODUCT', target_id: 'p1' })])?.id).toBe('d1');
    expect(getBestDiscount(product, [base({ scope: 'PRODUCT', target_id: 'p2' })])).toBeNull();
  });
});

describe('getBestDiscount — VARIANT scope', () => {
  const variant = (target: string) => base({ scope: 'VARIANT', target_id: target });

  it('matches an exact size+colour variant', () => {
    expect(getBestDiscount(product, [variant('p1:M:red')], 10000, 'M', 'red')?.id).toBe('d1');
  });

  it('does not match a different size or colour', () => {
    expect(getBestDiscount(product, [variant('p1:M:red')], 10000, 'S', 'red')).toBeNull();
    expect(getBestDiscount(product, [variant('p1:M:red')], 10000, 'M', 'blue')).toBeNull();
  });

  it('treats an empty size or colour in the target as a wildcard', () => {
    expect(getBestDiscount(product, [variant('p1::red')], 10000, 'ANY', 'red')?.id).toBe('d1');
    expect(getBestDiscount(product, [variant('p1:M:')], 10000, 'M', 'ANY')?.id).toBe('d1');
  });

  it('does not match another product', () => {
    expect(getBestDiscount(product, [variant('p2:M:red')], 10000, 'M', 'red')).toBeNull();
  });

  it('matches any one of several comma-separated targets', () => {
    const d = variant('p1:S:blue,p1:M:red');
    expect(getBestDiscount(product, [d], 10000, 'M', 'red')?.id).toBe('d1');
    expect(getBestDiscount(product, [d], 10000, 'S', 'blue')?.id).toBe('d1');
    expect(getBestDiscount(product, [d], 10000, 'L', 'green')).toBeNull();
  });
});

describe('getBestDiscount — picks the largest saving', () => {
  it('prefers the bigger percentage', () => {
    const best = getBestDiscount(product, [base({ id: 'small', value: 5 }), base({ id: 'big', value: 25 })]);
    expect(best?.id).toBe('big');
  });

  it('compares a fixed amount against a percentage on the actual price', () => {
    // 10% of 10,000 = 1,000, so a flat 2,000 wins.
    const best = getBestDiscount(product, [
      base({ id: 'pct', type: 'PERCENTAGE', value: 10 }),
      base({ id: 'flat', type: 'FIXED', value: 2000 }),
    ], 10000);
    expect(best?.id).toBe('flat');
  });

  it('uses the variant price, not the base price, when one is supplied', () => {
    // On a 1,000 variant, 50% = 500 beats a flat 400 — the opposite of the
    // answer you would get from the 10,000 base price.
    const best = getBestDiscount(product, [
      base({ id: 'pct', type: 'PERCENTAGE', value: 50 }),
      base({ id: 'flat', type: 'FIXED', value: 400 }),
    ], 1000);
    expect(best?.id).toBe('pct');
  });
});

describe('calculateSavings / calculateDiscountedPrice', () => {
  it('returns the price unchanged for no discount', () => {
    expect(calculateSavings(10000, null)).toBe(0);
    expect(calculateDiscountedPrice(10000, null)).toBe(10000);
  });

  it('applies a percentage', () => {
    expect(calculateDiscountedPrice(10000, base({ value: 15 }))).toBe(8500);
  });

  it('rounds to whole naira — order_items.price is an integer column', () => {
    // 15% off 12,999 = 11,049.15; an unrounded value fails the insert.
    const result = calculateDiscountedPrice(12999, base({ value: 15 }));
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(11049);
  });

  it('never discounts a fixed amount below zero', () => {
    expect(calculateSavings(500, base({ type: 'FIXED', value: 2000 }))).toBe(500);
    expect(calculateDiscountedPrice(500, base({ type: 'FIXED', value: 2000 }))).toBe(0);
  });

  it('handles 100% off', () => {
    expect(calculateDiscountedPrice(10000, base({ value: 100 }))).toBe(0);
  });

  it('never returns a negative price', () => {
    expect(calculateDiscountedPrice(1000, base({ value: 150 }))).toBe(0);
  });
});

describe('formatDiscountValue', () => {
  it('formats a percentage', () => {
    expect(formatDiscountValue({ type: 'PERCENTAGE', value: 20 })).toBe('20% OFF');
  });

  it('formats a fixed amount with thousands separators', () => {
    expect(formatDiscountValue({ type: 'FIXED', value: 2500 })).toBe('₦2,500 OFF');
  });

  it('supports the "save" wording', () => {
    expect(formatDiscountValue({ type: 'FIXED', value: 2500 }, 'save')).toBe('Save ₦2,500');
  });
});
