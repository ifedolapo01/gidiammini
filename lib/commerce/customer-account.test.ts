/**
 * The three decisions behind a passwordless account, tested without a browser
 * or a database.
 *
 * The reorder cases are the ones that matter most: a customer taps "buy it
 * again" on an order from three months ago, and the catalogue has moved on
 * underneath them. Every branch here is a thing that has actually happened to
 * a small shop's stock.
 */
import { describe, it, expect } from 'vitest';
import {
  buildReorderLines,
  maskEmail,
  parseContact,
  reorderSummary,
  type PastOrderLine,
} from './customer-account';
import { product, variant } from './product-fixtures';
import type { Product } from '@/types/product';

describe('parseContact', () => {
  it('reads an email, lower-cased', () => {
    expect(parseContact('  Ada@Example.COM ')).toEqual({ kind: 'email', email: 'ada@example.com' });
  });

  it('reads a Nigerian number written any of the usual ways', () => {
    // All four are one number, and a customer does not remember which form
    // they typed at checkout.
    for (const written of ['08065390671', '+2348065390671', '2348065390671', '0806 539 0671']) {
      expect(parseContact(written)).toEqual({ kind: 'phone', msisdn: '2348065390671' });
    }
  });

  it('returns null for something that is neither', () => {
    expect(parseContact('')).toBeNull();
    expect(parseContact('   ')).toBeNull();
    expect(parseContact('ada')).toBeNull();
    expect(parseContact('not an email@')).toBeNull();
  });
});

describe('maskEmail', () => {
  it('shows enough to find the inbox and no more', () => {
    const masked = maskEmail('adaobi@gmail.com');
    expect(masked.startsWith('ad')).toBe(true);
    expect(masked.endsWith('@gmail.com')).toBe(true);
    expect(masked).not.toContain('adaobi');
  });

  it('does not lengthen a short local part into a hint about its length', () => {
    // Three dots minimum, so "jo@x.com" and "jonathan@x.com" are not
    // distinguishable by counting.
    expect(maskEmail('jo@x.com')).toBe('jo•••@x.com');
  });

  it('degrades to nothing useful on a value that is not an address', () => {
    expect(maskEmail('nonsense')).toBe('•••');
  });
});

/** A past order line, defaulting to something buyable. */
const line = (over: Partial<PastOrderLine> = {}): PastOrderLine => ({
  product_id: product().id,
  product_name: 'Nap Set',
  price: 5000,
  quantity: 2,
  size: null,
  color: null,
  ...over,
});

describe('buildReorderLines', () => {
  it('rebuilds a line at the current price, not the price that was paid', () => {
    // A cart quoting last month's price is a cart that disagrees with the
    // checkout quote, and the customer finds out at the total.
    const now = product({ price: 6000, product_variants: [variant({ price: 6000, stock: 5 })] });
    const { lines, priceChanged } = buildReorderLines([line({ price: 5000 })], [now]);

    expect(lines).toHaveLength(1);
    expect(lines[0].price).toBe(6000);
    expect(priceChanged).toBe(true);
  });

  it('says nothing changed when nothing changed', () => {
    const same = product({ price: 5000, product_variants: [variant({ price: 5000, stock: 5 })] });
    expect(buildReorderLines([line({ price: 5000 })], [same]).priceChanged).toBe(false);
  });

  it('uses the current product name, so a renamed product reads as itself', () => {
    const renamed = product({ name: 'Nap Set (v2)', product_variants: [variant({ stock: 3 })] });
    expect(buildReorderLines([line({ product_name: 'Nap Set' })], [renamed]).lines[0].name).toBe(
      'Nap Set (v2)'
    );
  });

  it('clamps the quantity to what is left rather than failing the basket', () => {
    const nearlyGone = product({ product_variants: [variant({ stock: 1 })], stock: 1 });
    const { lines, skipped } = buildReorderLines([line({ quantity: 3 })], [nearlyGone]);

    expect(lines[0].quantity).toBe(1);
    expect(skipped).toEqual([]);
  });

  it('skips a sold-out line and names it', () => {
    const soldOut = product({ stock: 0, product_variants: [variant({ stock: 0 })] });
    const { lines, skipped } = buildReorderLines([line()], [soldOut]);

    expect(lines).toEqual([]);
    expect(skipped).toEqual([{ name: 'Nap Set', reason: 'out_of_stock' }]);
  });

  it('skips a delisted product', () => {
    const delisted = product({ is_active: false, product_variants: [variant({ stock: 9 })] });
    expect(buildReorderLines([line()], [delisted]).skipped).toEqual([
      { name: 'Nap Set', reason: 'unavailable' },
    ]);
  });

  it('skips a line whose product no longer exists at all', () => {
    // Nothing in the products list, and an order line that never carried an id.
    expect(buildReorderLines([line()], []).skipped[0].reason).toBe('unavailable');
    expect(buildReorderLines([line({ product_id: null })], []).skipped[0].reason).toBe('unavailable');
  });

  it('prices the exact variant that was bought', () => {
    const ranged = product({
      product_variants: [
        variant({ id: 'a', variant_key: 'S|red', size: 'S', color: 'red', price: 4000, stock: 4 }),
        variant({ id: 'b', variant_key: 'M|red', size: 'M', color: 'red', price: 7000, stock: 4 }),
      ],
    });

    const { lines } = buildReorderLines([line({ size: 'M', color: 'red', quantity: 1 })], [ranged]);
    expect(lines[0]).toMatchObject({ price: 7000, size: 'M', color: 'red' });
  });

  it('handles a mixed basket, keeping what it can', () => {
    const good = product({ id: 'good', product_variants: [variant({ stock: 5 })] });
    const gone = product({ id: 'gone', stock: 0, product_variants: [variant({ stock: 0 })] });

    const result = buildReorderLines(
      [line({ product_id: 'good' }), line({ product_id: 'gone', product_name: 'Bib' })],
      [good, gone]
    );

    expect(result.lines).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
  });
});

describe('reorderSummary', () => {
  const result = (lines: number, skipped: Array<'out_of_stock' | 'unavailable'>) => ({
    lines: Array.from({ length: lines }, () => ({}) as any),
    skipped: skipped.map((reason) => ({ name: 'x', reason })),
    priceChanged: false,
  });

  it('counts what went in', () => {
    expect(reorderSummary(result(1, []))).toBe('1 item added to your cart.');
    expect(reorderSummary(result(3, []))).toBe('3 items added to your cart.');
  });

  it('says what could not come back, and why', () => {
    expect(reorderSummary(result(2, ['out_of_stock']))).toBe(
      '2 items added to your cart — 1 sold out.'
    );
    expect(reorderSummary(result(1, ['out_of_stock', 'unavailable']))).toBe(
      '1 item added to your cart — 1 sold out, 1 no longer available.'
    );
  });

  it('does not claim an empty cart is a success', () => {
    expect(reorderSummary(result(0, ['out_of_stock']))).toMatch(/nothing from that order/i);
    expect(reorderSummary(result(0, []))).toMatch(/nothing to add/i);
  });
});
