/**
 * setVariantStock decides what number the admin's stock editor writes to the
 * database, and therefore how much of a product the storefront will sell.
 */
import { describe, it, expect } from 'vitest';
import { setVariantStock } from './stock-adjustment';
import type { PricingConfig } from '@/types/product';

const combination = (): PricingConfig => ({
  mode: 'combination',
  combinationPrices: { 'S|red': 1000, 'M|blue': 1000 },
  combinationStock: { 'S|red': 4, 'M|blue': 10 },
});

describe('setVariantStock', () => {
  it('replaces one combination bucket and re-derives the total', () => {
    const { stock, pricingConfig } = setVariantStock(combination(), 14, 'S|red', 10);
    expect(stock).toBe(20); // 14 - 4 + 10
    expect(pricingConfig.combinationStock).toEqual({ 'S|red': 10, 'M|blue': 10 });
  });

  it('lowers the total when a bucket is reduced', () => {
    const { stock, pricingConfig } = setVariantStock(combination(), 14, 'M|blue', 2);
    expect(stock).toBe(6); // 14 - 10 + 2
    expect(pricingConfig.combinationStock['M|blue']).toBe(2);
  });

  it('sets the total outright in single mode', () => {
    const { stock, pricingConfig } = setVariantStock({ mode: 'single', singleStock: 5 }, 5, 'single', 12);
    expect(stock).toBe(12);
    expect(pricingConfig.singleStock).toBe(12);
  });

  it("treats the 'single' key as single mode even for a variant config", () => {
    const { stock, pricingConfig } = setVariantStock(combination(), 14, 'single', 3);
    expect(stock).toBe(3);
    expect(pricingConfig.singleStock).toBe(3);
  });

  it('handles size mode', () => {
    const { stock, pricingConfig } = setVariantStock({ mode: 'size', sizeStock: { S: 3, M: 4 } }, 7, 'M', 9);
    expect(stock).toBe(12);
    expect(pricingConfig.sizeStock).toEqual({ S: 3, M: 9 });
  });

  it('handles colour mode', () => {
    const { stock, pricingConfig } = setVariantStock({ mode: 'color', colorStock: { red: 2, blue: 4 } }, 6, 'red', 5);
    expect(stock).toBe(9);
    expect(pricingConfig.colorStock).toEqual({ red: 5, blue: 4 });
  });

  it('treats a bucket that does not exist yet as previously zero', () => {
    const { stock, pricingConfig } = setVariantStock({ mode: 'size', sizeStock: { S: 3 } }, 3, 'M', 5);
    expect(stock).toBe(8);
    expect(pricingConfig.sizeStock).toEqual({ S: 3, M: 5 });
  });

  it('defaults to single mode when there is no config', () => {
    const { stock, pricingConfig } = setVariantStock(null, 0, 'single', 7);
    expect(stock).toBe(7);
    expect(pricingConfig.singleStock).toBe(7);
  });

  it('accepts zero, which is how a variant is marked sold out', () => {
    const { stock, pricingConfig } = setVariantStock(combination(), 14, 'S|red', 0);
    expect(stock).toBe(10);
    expect(pricingConfig.combinationStock['S|red']).toBe(0);
  });

  it('does not mutate the pricing_config it was given', () => {
    // A shallow spread shares the nested bucket maps, so the previous
    // implementation rewrote the caller's own object while "returning" a copy.
    const original = combination();
    const before = JSON.parse(JSON.stringify(original));
    setVariantStock(original, 14, 'S|red', 99);
    expect(original).toEqual(before);
  });

  it('leaves the other buckets untouched', () => {
    const { pricingConfig } = setVariantStock(combination(), 14, 'S|red', 1);
    expect(pricingConfig.combinationStock['M|blue']).toBe(10);
    expect(pricingConfig.combinationPrices).toEqual(combination().combinationPrices);
  });
});
