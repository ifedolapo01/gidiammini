/**
 * Variant price and stock lookup. getVariantPrice is what priceOrder() charges
 * from, and getVariantStock is the number both the storefront shows and the
 * server checks availability against — so the two must read the same buckets.
 */
import { describe, it, expect } from 'vitest';
import { getVariantPrice, getVariantStock, getProductPriceRange, formatCurrency, formatPriceRange } from './pricing';
import { variantKeyFor } from './product-variants';
import type { Product } from '@/types/product';

const product = (over: Partial<Product>): Product => ({
  id: 'p1', name: 'Gown', description: null, price: 10000, category: 'babies',
  main_image: 'x', images: [], colors: [], sizes: [], details: [],
  stock: 14, is_active: true,
  created_at: '', updated_at: '', ...over,
});

/** Attaches product_variants rows, exactly as the migration's backfill produces. */
const withVariants = (
  base: Partial<Product>,
  rows: Array<[string | null, string | null, number, number]>
): Product =>
  product({
    ...base,
    product_variants: rows.map(([size, color, price, stock], index) => ({
      id: `v${index}`,
      product_id: 'p1',
      size,
      color,
      variant_key: variantKeyFor(size, color),
      price,
      stock,
      image_url: null,
      is_active: true,
    })),
  });

const combo = withVariants({ price: 10000 }, [
  ['S', 'red', 13000, 4],
  ['M', 'brown', 16000, 10],
]);

describe('getVariantPrice', () => {
  it('uses the base price when there are no variant rows', () => {
    expect(getVariantPrice(product({}))).toBe(10000);
  });

  it('uses the base price for a lone variant with no axes', () => {
    expect(getVariantPrice(withVariants({}, [[null, null, 10000, 5]]))).toBe(10000);
  });

  it('reads the size-only variant', () => {
    const p = withVariants({}, [['S', null, 8000, 3], ['M', null, 9000, 4]]);
    expect(getVariantPrice(p, 'M')).toBe(9000);
  });

  it('reads the colour-only variant', () => {
    const p = withVariants({}, [[null, 'red', 7000, 3]]);
    expect(getVariantPrice(p, null, 'red')).toBe(7000);
  });

  it('reads the combination variant', () => {
    expect(getVariantPrice(combo, 'M', 'brown')).toBe(16000);
  });

  it('falls back to the base price when only half a combination is selected', () => {
    expect(getVariantPrice(combo, 'M')).toBe(10000);
    expect(getVariantPrice(combo, null, 'brown')).toBe(10000);
  });

  it('falls back to the base price for an unknown variant', () => {
    expect(getVariantPrice(combo, 'XL', 'gold')).toBe(10000);
  });
});

describe('getVariantStock', () => {
  it('returns zero when there are no variant rows', () => {
    expect(getVariantStock(product({ stock: 14 }))).toBe(0);
  });

  it('reads the lone variant with no axes', () => {
    expect(getVariantStock(withVariants({ stock: 13 }, [[null, null, 10000, 14]]))).toBe(14);
  });

  it('reads the combination variant', () => {
    expect(getVariantStock(combo, 'S', 'red')).toBe(4);
    expect(getVariantStock(combo, 'M', 'brown')).toBe(10);
  });

  it('returns zero for a sold-out variant rather than the product total', () => {
    const soldOut = withVariants({ stock: 10 }, [['S', 'red', 1, 0]]);
    expect(getVariantStock(soldOut, 'S', 'red')).toBe(0);
  });

  it('falls back to zero for an unknown variant', () => {
    expect(getVariantStock(combo, 'XL', 'gold')).toBe(0);
  });
});

describe('getProductPriceRange', () => {
  it('is a single point with no variant rows', () => {
    expect(getProductPriceRange(product({ price: 10000 }))).toEqual({ min: 10000, max: 10000 });
  });

  it('spans the combination prices', () => {
    expect(getProductPriceRange(combo)).toEqual({ min: 13000, max: 16000 });
  });

  it('spans the size-only prices', () => {
    const p = withVariants({}, [['S', null, 8000, 1], ['M', null, 12000, 1], ['L', null, 9000, 1]]);
    expect(getProductPriceRange(p)).toEqual({ min: 8000, max: 12000 });
  });

  it('falls back to the base price when there are no active variants', () => {
    const p = withVariants({ price: 10000 }, []);
    expect(getProductPriceRange(p)).toEqual({ min: 10000, max: 10000 });
  });
});

describe('formatting', () => {
  // formatCurrency takes minor units (20260910130000) — ₦16,500 is 1,650,000
  // kobo — and NGN still renders with no decimal places, as it always has.
  it('formats naira with thousands separators', () => {
    expect(formatCurrency(1_650_000)).toBe('₦16,500');
  });

  it('shows a sub-naira amount now that minor units can represent one', () => {
    expect(formatCurrency(16_530)).toBe('₦165');
  });

  it('formats a non-NGN currency with its own default decimal places', () => {
    // en-NG renders USD as "US$", not a bare "$" — that ambiguity is the
    // locale doing its job once more than one currency is in play.
    expect(formatCurrency(1_650_050, 'USD')).toBe('US$16,500.50');
  });

  it('collapses an equal range to one value', () => {
    expect(formatPriceRange(1_000_000, 1_000_000)).toBe('₦10,000');
  });

  it('shows a real range', () => {
    expect(formatPriceRange(1_300_000, 1_650_000)).toBe('₦13,000 - ₦16,500');
  });
});
