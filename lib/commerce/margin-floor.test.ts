/**
 * The margin floor on the discount form.
 *
 * Two things must hold. A discount that would sell below cost has to be caught
 * per variant, because scope-wide averages hide it — a 40% sale is fine on a
 * 70%-margin line and a loss on a 25% one. And a variant with no cost must be
 * reported as *unchecked*, never as safe: a clean result on an uncosted
 * catalogue is the most misleading answer this could give.
 */
import { describe, it, expect } from 'vitest';
import { findBelowCostVariants } from './margin-floor';
import { variantKeyFor, type ProductVariant } from './product-variants';

const variant = (
  size: string | null,
  color: string | null,
  price: number,
  cost: number | null
): ProductVariant => ({
  id: `v-${size}-${color}`,
  product_id: 'p1',
  size,
  color,
  variant_key: variantKeyFor(size, color),
  price,
  stock: 5,
  image_url: null,
  is_active: true,
  cost,
});

/** A gown at three margins: healthy, thin, and one with no cost recorded. */
const products = [
  {
    id: 'p1',
    name: 'Premium Baby Gown',
    category: 'babies',
    sub_category: 'babies-gowns',
    is_active: true,
    product_variants: [
      variant('1-2 months', 'red', 10000, 3000),
      variant('3-5 months', 'brown', 10000, 9000),
      variant('3-5 months', 'Yellow', 10000, null),
    ],
  },
  {
    id: 'p2',
    name: 'Pickard Bracelet',
    category: 'kids',
    sub_category: 'kids-accessories',
    is_active: true,
    product_variants: [variant('S', 'Multicolour', 5000, 4800)],
  },
];

describe('findBelowCostVariants', () => {
  it('catches the thin-margin variant a scope-wide average would hide', () => {
    // 20% off: fine at 3000 cost, a loss at 9000.
    const result = findBelowCostVariants(products, {
      type: 'PERCENTAGE', value: 20, scope: 'SITEWIDE', target_id: null,
    });

    expect(result.below.map((v) => v.label)).toEqual(['3-5 months / brown', 'S / Multicolour']);
    expect(result.below[0]).toMatchObject({ discountedPrice: 8000, cost: 9000, lossPerUnit: 1000 });
  });

  it('orders by the biggest loss first', () => {
    const result = findBelowCostVariants(products, {
      type: 'PERCENTAGE', value: 50, scope: 'SITEWIDE', target_id: null,
    });
    const losses = result.below.map((v) => v.lossPerUnit);
    expect(losses).toEqual([...losses].sort((a, b) => b - a));
  });

  it('counts an uncosted variant as unchecked, never as safe', () => {
    const result = findBelowCostVariants(products, {
      type: 'PERCENTAGE', value: 90, scope: 'PRODUCT', target_id: 'p1',
    });

    // Two of the three gown variants have a cost; the third cannot be judged.
    expect(result.checkedCount).toBe(2);
    expect(result.uncheckedCount).toBe(1);
    expect(result.below).toHaveLength(2);
    expect(result.below.some((v) => v.label.includes('Yellow'))).toBe(false);
  });

  it('finds nothing when the discount is affordable everywhere', () => {
    const result = findBelowCostVariants(products, {
      type: 'PERCENTAGE', value: 2, scope: 'SITEWIDE', target_id: null,
    });
    expect(result.below).toEqual([]);
    expect(result.checkedCount).toBe(3);
  });

  it('says nothing at all for a zero or missing value', () => {
    // Nothing has been typed yet — a warning here would be noise.
    for (const value of [0, -5, NaN]) {
      const result = findBelowCostVariants(products, {
        type: 'PERCENTAGE', value, scope: 'SITEWIDE', target_id: null,
      });
      expect(result.checkedCount).toBe(0);
      expect(result.below).toEqual([]);
    }
  });
});

describe('scope', () => {
  it('limits a CATEGORY discount to that category', () => {
    const result = findBelowCostVariants(products, {
      type: 'PERCENTAGE', value: 50, scope: 'CATEGORY', target_id: 'kids',
    });
    expect(result.below.map((v) => v.productName)).toEqual(['Pickard Bracelet']);
  });

  it('limits a SUBCATEGORY discount to that subcategory', () => {
    const result = findBelowCostVariants(products, {
      type: 'PERCENTAGE', value: 50, scope: 'SUBCATEGORY', target_id: 'babies-gowns',
    });
    expect(result.below.every((v) => v.productId === 'p1')).toBe(true);
  });

  it('limits a PRODUCT discount to that product', () => {
    const result = findBelowCostVariants(products, {
      type: 'PERCENTAGE', value: 50, scope: 'PRODUCT', target_id: 'p2',
    });
    expect(result.below).toHaveLength(1);
    expect(result.below[0].productId).toBe('p2');
  });

  it('limits a VARIANT discount to the targeted variants', () => {
    const result = findBelowCostVariants(products, {
      type: 'PERCENTAGE', value: 50, scope: 'VARIANT',
      target_id: 'p1:3-5 months:brown',
    });
    expect(result.below).toHaveLength(1);
    expect(result.below[0].label).toBe('3-5 months / brown');
  });

  it('checks nothing for a scope with no matching target', () => {
    const result = findBelowCostVariants(products, {
      type: 'PERCENTAGE', value: 50, scope: 'CATEGORY', target_id: 'nonexistent',
    });
    expect(result.checkedCount).toBe(0);
    expect(result.below).toEqual([]);
  });

  it('ignores inactive products and inactive variants', () => {
    const withInactive = [
      { ...products[1], is_active: false },
      {
        id: 'p3',
        name: 'Retired Line',
        category: 'kids',
        is_active: true,
        product_variants: [{ ...variant('M', 'blue', 5000, 4900), is_active: false }],
      },
    ];
    const result = findBelowCostVariants(withInactive, {
      type: 'PERCENTAGE', value: 50, scope: 'SITEWIDE', target_id: null,
    });
    expect(result.checkedCount).toBe(0);
  });
});

describe('FIXED discounts', () => {
  it('checks a fixed amount off against cost', () => {
    // ₦2,000 off a ₦10,000 line: fine at 3000 cost, a loss at 9000.
    const result = findBelowCostVariants(products, {
      type: 'FIXED', value: 2000, scope: 'PRODUCT', target_id: 'p1',
    });
    expect(result.below.map((v) => v.label)).toEqual(['3-5 months / brown']);
    expect(result.below[0].discountedPrice).toBe(8000);
  });

  it('treats a discount larger than the price as a zero price, not a negative one', () => {
    const result = findBelowCostVariants(products, {
      type: 'FIXED', value: 99999, scope: 'PRODUCT', target_id: 'p2',
    });
    expect(result.below[0].discountedPrice).toBe(0);
    expect(result.below[0].lossPerUnit).toBe(4800);
  });
});

describe('tolerance', () => {
  it('does not throw on a product with no variants embedded', () => {
    const result = findBelowCostVariants(
      [{ id: 'p9', name: 'Unloaded', category: 'kids', is_active: true }],
      { type: 'PERCENTAGE', value: 50, scope: 'SITEWIDE', target_id: null }
    );
    expect(result.below).toEqual([]);
  });

  it('does not throw on an empty catalogue', () => {
    expect(
      findBelowCostVariants([], { type: 'PERCENTAGE', value: 50, scope: 'SITEWIDE', target_id: null })
    ).toMatchObject({ below: [], checkedCount: 0 });
  });
});
