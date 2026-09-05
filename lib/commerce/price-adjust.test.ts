import { describe, it, expect } from 'vitest';
import { adjustPricing, isValidPercent, describePercent } from './price-adjust';
import type { PricingConfig } from '@/types/product';

describe('adjustPricing', () => {
  it('marks a simple product down', () => {
    expect(adjustPricing({ price: 10000 }, -30)).toEqual({ price: 7000, pricing_config: null });
  });

  it('marks a simple product up', () => {
    expect(adjustPricing({ price: 10000 }, 10).price).toBe(11000);
  });

  it('rounds to whole naira, because both price columns are integers', () => {
    expect(adjustPricing({ price: 999 }, -33).price).toBe(669);
  });

  it('never produces a negative price', () => {
    expect(adjustPricing({ price: 500 }, -99).price).toBe(5);
  });

  it('moves every variant price map, not just the product price', () => {
    // Writing product_variants alone looks right until the next ordinary save
    // re-derives the variants from an untouched pricing_config.
    const config: PricingConfig = {
      mode: 'combination',
      combinationPrices: { '0-3 months|red': 5000, '3-6 months|blue': 6000 },
      combinationStock: { '0-3 months|red': 4, '3-6 months|blue': 2 },
      sizePrices: { '0-3 months': 5200 },
      colorPrices: { red: 5100 },
    };

    const result = adjustPricing({ price: 5000, pricing_config: config }, -50);

    expect(result.price).toBe(2500);
    expect(result.pricing_config?.combinationPrices).toEqual({
      '0-3 months|red': 2500,
      '3-6 months|blue': 3000,
    });
    expect(result.pricing_config?.sizePrices).toEqual({ '0-3 months': 2600 });
    expect(result.pricing_config?.colorPrices).toEqual({ red: 2550 });
  });

  it('leaves the stock and image maps alone', () => {
    const config: PricingConfig = {
      mode: 'color',
      colorPrices: { red: 4000 },
      colorStock: { red: 12 },
      colorImages: { red: 'https://cdn.test/red.jpg' },
    };

    const result = adjustPricing({ price: 4000, pricing_config: config }, -25);

    expect(result.pricing_config?.colorStock).toEqual({ red: 12 });
    expect(result.pricing_config?.colorImages).toEqual({ red: 'https://cdn.test/red.jpg' });
  });

  it('does not mutate the config it was given', () => {
    const config: PricingConfig = { mode: 'size', sizePrices: { s: 1000 } };
    adjustPricing({ price: 1000, pricing_config: config }, -10);
    expect(config.sizePrices).toEqual({ s: 1000 });
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
