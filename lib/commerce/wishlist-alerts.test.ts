/**
 * What a saved product has earned an email about.
 *
 * These rules decide whether a real person is mailed, so the ones worth
 * pinning down are the negatives: never on a change we never observed, never
 * on a drop too small to notice, never about something that cannot be bought.
 * A wishlist stops being worth having the moment it starts behaving like a
 * newsletter.
 */
import { describe, it, expect } from 'vitest';
import {
  decideWishlistAlert,
  observeWatch,
  priceDropAmount,
  MIN_PRICE_DROP_RATIO,
  type WishlistWatch,
  type WatchedProduct,
} from './wishlist-alerts';

const watch = (overrides: Partial<WishlistWatch> = {}): WishlistWatch => ({
  customerId: 'c1',
  productId: 'p1',
  referencePrice: 10_000,
  lastSeenStock: 4,
  ...overrides,
});

const product = (overrides: Partial<WatchedProduct> = {}): WatchedProduct => ({
  id: 'p1',
  name: 'Ribbed Bodysuit',
  price: 10_000,
  stock: 4,
  ...overrides,
});

describe('back in stock', () => {
  it('fires on a 0 -> positive change', () => {
    const alert = decideWishlistAlert(watch({ lastSeenStock: 0 }), product({ stock: 3 }));
    expect(alert).toMatchObject({ kind: 'back-in-stock', productName: 'Ribbed Bodysuit' });
  });

  it('does not fire on a restock of something that was never out', () => {
    // 4 -> 6 restocks nothing that was unavailable, and mailing on it would
    // train people to ignore the mail.
    expect(decideWishlistAlert(watch({ lastSeenStock: 4 }), product({ stock: 6 }))).toBeNull();
  });

  it('says nothing on a row that has never been observed', () => {
    // Saved before any of this existed. The sweep records the state and waits.
    expect(decideWishlistAlert(watch({ lastSeenStock: null }), product({ stock: 5 }))).toBeNull();
  });

  it('outranks a price drop when both are true', () => {
    // One email per product per sweep, and a restock is the one that expires.
    const alert = decideWishlistAlert(
      watch({ lastSeenStock: 0, referencePrice: 10_000 }),
      product({ stock: 2, price: 5_000 })
    );
    expect(alert?.kind).toBe('back-in-stock');
  });
});

describe('price drop', () => {
  it('fires once the drop is big enough to notice', () => {
    const alert = decideWishlistAlert(watch({ referencePrice: 10_000 }), product({ price: 9_000 }));
    expect(alert).toMatchObject({ kind: 'price-drop', price: 9_000, referencePrice: 10_000 });
    expect(priceDropAmount(alert!)).toBe(1_000);
  });

  it('fires exactly at the threshold, not a naira before it', () => {
    const justUnder = 10_000 * (1 - MIN_PRICE_DROP_RATIO); // 9,500
    expect(decideWishlistAlert(watch(), product({ price: justUnder }))?.kind).toBe('price-drop');
    expect(decideWishlistAlert(watch(), product({ price: justUnder + 1 }))).toBeNull();
  });

  it('ignores a rounding-error drop', () => {
    expect(decideWishlistAlert(watch({ referencePrice: 13_000 }), product({ price: 12_980 }))).toBeNull();
  });

  it('ignores a price that went up', () => {
    expect(decideWishlistAlert(watch({ referencePrice: 10_000 }), product({ price: 12_000 }))).toBeNull();
  });

  it('says nothing about something sold out, however cheap', () => {
    // A cheaper sold-out product is not an offer.
    expect(decideWishlistAlert(watch(), product({ price: 1_000, stock: 0 }))).toBeNull();
  });

  it('says nothing without a baseline to compare against', () => {
    expect(decideWishlistAlert(watch({ referencePrice: null }), product({ price: 1 }))).toBeNull();
    expect(decideWishlistAlert(watch({ referencePrice: 0 }), product({ price: 1 }))).toBeNull();
  });
});

describe('observeWatch', () => {
  it('records the state of a row seen for the first time', () => {
    const state = observeWatch(
      watch({ referencePrice: null, lastSeenStock: null }),
      product({ price: 8_000, stock: 2 }),
      null
    );
    expect(state).toEqual({ reference_price: 8_000, last_seen_stock: 2 });
  });

  it('re-baselines to the price it just announced', () => {
    const current = product({ price: 9_000 });
    const alert = decideWishlistAlert(watch(), current)!;
    expect(observeWatch(watch(), current, alert).reference_price).toBe(9_000);
  });

  it('holds the baseline through drops too small to announce', () => {
    // The point of the rule: two per cent a week must eventually add up to an
    // email, rather than re-baselining every sweep and never crossing it.
    let held = watch({ referencePrice: 10_000 });
    for (const price of [9_900, 9_800, 9_700, 9_600]) {
      const current = product({ price });
      const alert = decideWishlistAlert(held, current);
      expect(alert).toBeNull();
      held = { ...held, ...remap(observeWatch(held, current, alert)) };
    }

    // 9,500 is five per cent off the price it was saved at — measured from the
    // original, not from last week.
    const final = product({ price: 9_500 });
    expect(decideWishlistAlert(held, final)?.kind).toBe('price-drop');
  });

  it('does not follow the price up', () => {
    const state = observeWatch(watch({ referencePrice: 10_000 }), product({ price: 14_000 }), null);
    expect(state.reference_price).toBe(10_000);
  });

  it('always records current stock, alert or not', () => {
    expect(observeWatch(watch(), product({ stock: 0 }), null).last_seen_stock).toBe(0);
  });
});

/** The stored row, back in the shape the next sweep reads. */
function remap(state: { reference_price: number; last_seen_stock: number }) {
  return { referencePrice: state.reference_price, lastSeenStock: state.last_seen_stock };
}
