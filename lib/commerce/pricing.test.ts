/**
 * Variant price and stock lookup. getVariantPrice is what priceOrder() charges
 * from, and getVariantStock is the number both the storefront shows and the
 * server checks availability against — so the two must read the same buckets.
 */
import { describe, it, expect } from 'vitest';
import { getVariantPrice, getVariantStock, getProductPriceRange, formatCurrency, formatPriceRange } from './pricing';
import type { Product } from '@/types/product';

const product = (over: Partial<Product>): Product => ({
  id: 'p1', name: 'Gown', description: null, price: 10000, category: 'babies',
  main_image: 'x', images: [], colors: [], sizes: [], details: [],
  stock: 14, is_active: true, pricing_config: null,
  created_at: '', updated_at: '', ...over,
});

const combo = product({
  pricing_config: {
    mode: 'combination',
    combinationPrices: { 'S|red': 13000, 'M|brown': 16000 },
    combinationStock: { 'S|red': 4, 'M|brown': 10 },
  },
});

describe('getVariantPrice', () => {
  it('uses the base price when there is no config', () => {
    expect(getVariantPrice(product({ pricing_config: null }))).toBe(10000);
  });

  it('uses the base price in single mode', () => {
    expect(getVariantPrice(product({ pricing_config: { mode: 'single', singleStock: 5 } }))).toBe(10000);
  });

  it('reads the size bucket', () => {
    const p = product({ pricing_config: { mode: 'size', sizePrices: { S: 8000, M: 9000 } } });
    expect(getVariantPrice(p, 'M')).toBe(9000);
  });

  it('reads the colour bucket', () => {
    const p = product({ pricing_config: { mode: 'color', colorPrices: { red: 7000 } } });
    expect(getVariantPrice(p, null, 'red')).toBe(7000);
  });

  it('reads the combination bucket', () => {
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
  it('uses the product total when there is no config', () => {
    expect(getVariantStock(product({ pricing_config: null }))).toBe(14);
  });

  it('prefers singleStock over the product total in single mode', () => {
    const p = product({ stock: 13, pricing_config: { mode: 'single', singleStock: 14 } });
    expect(getVariantStock(p)).toBe(14);
  });

  it('reads the combination bucket', () => {
    expect(getVariantStock(combo, 'S', 'red')).toBe(4);
    expect(getVariantStock(combo, 'M', 'brown')).toBe(10);
  });

  it('returns zero for a sold-out variant rather than the product total', () => {
    const soldOut = product({
      stock: 10,
      pricing_config: { mode: 'combination', combinationStock: { 'S|red': 0 }, combinationPrices: { 'S|red': 1 } },
    });
    expect(getVariantStock(soldOut, 'S', 'red')).toBe(0);
  });

  it('falls back to the product total for an unknown variant', () => {
    expect(getVariantStock(combo, 'XL', 'gold')).toBe(14);
  });
});

describe('getProductPriceRange', () => {
  it('is a single point with no config', () => {
    expect(getProductPriceRange(product({ pricing_config: null }))).toEqual({ min: 10000, max: 10000 });
  });

  it('spans the combination prices', () => {
    expect(getProductPriceRange(combo)).toEqual({ min: 13000, max: 16000 });
  });

  it('spans the size prices', () => {
    const p = product({ pricing_config: { mode: 'size', sizePrices: { S: 8000, M: 12000, L: 9000 } } });
    expect(getProductPriceRange(p)).toEqual({ min: 8000, max: 12000 });
  });

  it('falls back to the base price when the buckets are empty', () => {
    const p = product({ pricing_config: { mode: 'combination', combinationPrices: {} } });
    expect(getProductPriceRange(p)).toEqual({ min: 10000, max: 10000 });
  });

  it('ignores non-numeric bucket values rather than producing NaN', () => {
    const p = product({
      pricing_config: { mode: 'size', sizePrices: { S: 8000, M: undefined as any, L: 'x' as any } },
    });
    const range = getProductPriceRange(p);
    expect(Number.isNaN(range.min)).toBe(false);
    expect(Number.isNaN(range.max)).toBe(false);
    expect(range).toEqual({ min: 8000, max: 8000 });
  });
});

describe('formatting', () => {
  it('formats naira with thousands separators', () => {
    expect(formatCurrency(16500)).toBe('₦16,500');
  });

  it('collapses an equal range to one value', () => {
    expect(formatPriceRange(10000, 10000)).toBe('₦10,000');
  });

  it('shows a real range', () => {
    expect(formatPriceRange(13000, 16500)).toBe('₦13,000 - ₦16,500');
  });
});
