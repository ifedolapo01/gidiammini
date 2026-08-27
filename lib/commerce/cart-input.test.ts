/**
 * The trust boundary for a cart arriving from a browser. Everything here exists
 * because the client used to send prices; these tests pin that it can't, and
 * that a split cart can't slip past a stock check.
 */
import { describe, it, expect } from 'vitest';
import {
  parseCartLines, mergeCartLines, parseDeliveryOption, asTrimmedString,
  MAX_LINE_QUANTITY, MAX_CART_LINES,
} from './cart-input';

const line = (over: Record<string, unknown> = {}) => ({
  product_id: 'p1', size: 'M', color: 'red', quantity: 2, ...over,
});

describe('parseCartLines — drops anything it does not recognise', () => {
  it('keeps only product/size/colour/quantity', () => {
    const parsed = parseCartLines([line({ price: 1, product_name: 'HACKED', total: 999 })]);
    expect(parsed).toEqual([{ product_id: 'p1', size: 'M', color: 'red', quantity: 2 }]);
  });

  it('does not carry a client-supplied price through under any key', () => {
    const parsed = parseCartLines([line({ price: 1, unit_price: 1, amount: 1 })]);
    const keys = Object.keys((parsed as any[])[0]);
    expect(keys.sort()).toEqual(['color', 'product_id', 'quantity', 'size']);
  });

  it('accepts the camelCase productId the cart provider uses', () => {
    const parsed = parseCartLines([{ productId: 'p9', size: null, color: null, quantity: 1 }]);
    expect((parsed as any[])[0].product_id).toBe('p9');
  });

  it('normalises empty and whitespace-only size/colour to null', () => {
    const parsed = parseCartLines([line({ size: '   ', color: '' })]);
    expect((parsed as any[])[0]).toMatchObject({ size: null, color: null });
  });

  it('trims size and colour', () => {
    const parsed = parseCartLines([line({ size: '  M  ', color: ' red ' })]);
    expect((parsed as any[])[0]).toMatchObject({ size: 'M', color: 'red' });
  });
});

describe('parseCartLines — rejects bad input with a customer-facing message', () => {
  const rejects = (input: unknown) => {
    const result = parseCartLines(input);
    expect(typeof result).toBe('string');
    return result as string;
  };

  it('rejects a non-array', () => {
    expect(rejects(null)).toMatch(/empty/i);
    expect(rejects('nope')).toMatch(/empty/i);
    expect(rejects({})).toMatch(/empty/i);
  });

  it('rejects an empty cart', () => {
    expect(rejects([])).toMatch(/empty/i);
  });

  it('rejects a cart with too many lines', () => {
    const many = Array.from({ length: MAX_CART_LINES + 1 }, (_, i) => line({ product_id: `p${i}` }));
    expect(rejects(many)).toMatch(new RegExp(String(MAX_CART_LINES)));
  });

  it('rejects a malformed entry', () => {
    expect(rejects(['nope'])).toMatch(/malformed/i);
    expect(rejects([null])).toMatch(/malformed/i);
  });

  it('rejects a missing product id', () => {
    expect(rejects([line({ product_id: '' })])).toMatch(/missing a product/i);
    expect(rejects([line({ product_id: undefined })])).toMatch(/missing a product/i);
  });

  it('rejects a non-integer, zero, negative or oversized quantity', () => {
    for (const quantity of [0, -3, 1.5, NaN, 'two', MAX_LINE_QUANTITY + 1]) {
      expect(rejects([line({ quantity })])).toMatch(/whole number/i);
    }
  });
});

describe('mergeCartLines', () => {
  it('sums duplicate lines for the same variant', () => {
    // The bug this prevents: two lines of 1 against a stock of 1 both pass a
    // per-line check, and the store oversells.
    const merged = mergeCartLines([
      { product_id: 'p1', size: 'M', color: 'red', quantity: 1 },
      { product_id: 'p1', size: 'M', color: 'red', quantity: 1 },
    ]);
    expect(merged).toEqual([{ product_id: 'p1', size: 'M', color: 'red', quantity: 2 }]);
  });

  it('keeps different variants of the same product separate', () => {
    const merged = mergeCartLines([
      { product_id: 'p1', size: 'M', color: 'red', quantity: 1 },
      { product_id: 'p1', size: 'S', color: 'red', quantity: 1 },
    ]);
    expect(merged).toHaveLength(2);
  });

  it('treats null size/colour as its own distinct variant', () => {
    const merged = mergeCartLines([
      { product_id: 'p1', size: null, color: null, quantity: 1 },
      { product_id: 'p1', size: 'M', color: null, quantity: 1 },
    ]);
    expect(merged).toHaveLength(2);
  });

  it('caps a merged quantity at the per-line ceiling', () => {
    const merged = mergeCartLines([
      { product_id: 'p1', size: null, color: null, quantity: MAX_LINE_QUANTITY },
      { product_id: 'p1', size: null, color: null, quantity: MAX_LINE_QUANTITY },
    ]);
    expect(merged[0].quantity).toBe(MAX_LINE_QUANTITY);
  });
});

describe('parseDeliveryOption', () => {
  it('accepts the two valid options', () => {
    expect(parseDeliveryOption('pickup')).toBe('pickup');
    expect(parseDeliveryOption('delivery')).toBe('delivery');
  });

  it('rejects anything else rather than guessing', () => {
    for (const bad of ['Pickup', 'free', '', null, undefined, 1, {}]) {
      expect(parseDeliveryOption(bad)).toBeNull();
    }
  });
});

describe('asTrimmedString', () => {
  it('trims and returns real strings', () => {
    expect(asTrimmedString('  Lagos ')).toBe('Lagos');
  });

  it('returns null for empty, whitespace, and non-strings', () => {
    for (const bad of ['', '   ', null, undefined, 5, {}, []]) {
      expect(asTrimmedString(bad)).toBeNull();
    }
  });
});
