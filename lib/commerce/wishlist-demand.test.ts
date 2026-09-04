/**
 * The panel exists to answer one question — what should be restocked next —
 * so what matters is that unmet demand outranks popularity. A sold-out product
 * a handful of people are waiting on is an order to place; the same handful on
 * something with forty in stock is not.
 */
import { describe, it, expect } from 'vitest';
import { rankWishlistDemand, type WishlistDemandRow } from './wishlist-demand';

const row = (overrides: Partial<WishlistDemandRow> = {}): WishlistDemandRow => ({
  product_id: 'p1',
  product_name: 'Ribbed Bodysuit',
  main_image: 'https://cdn.example/a.jpg',
  stock: 10,
  price: 5_000,
  saved_by: 3,
  last_saved_at: '2026-09-01T00:00:00Z',
  ...overrides,
});

describe('rankWishlistDemand', () => {
  it('puts what nobody can buy above what is merely popular', () => {
    const ranked = rankWishlistDemand(
      [
        row({ product_id: 'popular', saved_by: 11, stock: 40 }),
        row({ product_id: 'sold-out', saved_by: 4, stock: 0 }),
      ],
      5
    );
    expect(ranked.map((entry) => entry.productId)).toEqual(['sold-out', 'popular']);
  });

  it('marks which rows are the ones to act on', () => {
    const ranked = rankWishlistDemand(
      [
        row({ product_id: 'sold-out', stock: 0 }),
        row({ product_id: 'low', stock: 2 }),
        row({ product_id: 'fine', stock: 40 }),
      ],
      5
    );
    expect(ranked.map((entry) => [entry.productId, entry.unmet])).toEqual([
      ['sold-out', true],
      ['low', true],
      ['fine', false],
    ]);
  });

  it('falls back to raw savers when availability matches', () => {
    const ranked = rankWishlistDemand(
      [row({ product_id: 'a', saved_by: 2 }), row({ product_id: 'b', saved_by: 9 })],
      5
    );
    expect(ranked[0].productId).toBe('b');
  });

  it('respects the limit', () => {
    const rows = Array.from({ length: 20 }, (_, index) =>
      row({ product_id: `p${index}`, saved_by: index })
    );
    expect(rankWishlistDemand(rows, 8)).toHaveLength(8);
  });

  it('skips a row with no product behind it', () => {
    // A view row can only be missing an id if the join produced nothing; it is
    // not something to render a card for.
    expect(rankWishlistDemand([row({ product_id: null })], 5)).toEqual([]);
  });

  it('tolerates nulls from the view', () => {
    const [entry] = rankWishlistDemand(
      [row({ product_name: null, stock: null, price: null, saved_by: null })],
      5
    );
    expect(entry).toMatchObject({ name: 'Untitled product', stock: 0, price: 0, savedBy: 0, unmet: true });
  });
});
