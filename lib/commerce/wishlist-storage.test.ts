/**
 * Reading a wishlist out of the browser.
 *
 * The interesting case is the old shape. Every visitor with a saved list is
 * carrying an array of whole product objects until the first time this runs,
 * and losing those lists on the deploy that changed the format would be a
 * worse bug than the stale prices it was fixing.
 */
import { describe, it, expect } from 'vitest';
import { readStoredWishlist } from './wishlist-storage';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('readStoredWishlist', () => {
  it('reads the current shape', () => {
    expect(readStoredWishlist(JSON.stringify([A, B]))).toEqual([A, B]);
  });

  it('converts the old shape, keeping only the ids', () => {
    // The rest of the snapshot — price, stock, name — is exactly what went
    // stale, and none of it survives the read.
    const legacy = JSON.stringify([
      { id: A, name: 'Ribbed Bodysuit', price: 5000, stock: 3 },
      { id: B, name: 'Knitted Booties', price: 3000, stock: 0 },
    ]);
    expect(readStoredWishlist(legacy)).toEqual([A, B]);
  });

  it('reads a list that is halfway between the two shapes', () => {
    expect(readStoredWishlist(JSON.stringify([A, { id: B }]))).toEqual([A, B]);
  });

  it('drops entries that carry no usable id', () => {
    const mixed = JSON.stringify([A, { name: 'no id here' }, null, 42, { id: 'not-a-uuid' }]);
    expect(readStoredWishlist(mixed)).toEqual([A]);
  });

  it('deduplicates a product saved under both shapes', () => {
    expect(readStoredWishlist(JSON.stringify([A, { id: A }]))).toEqual([A]);
  });

  it('returns an empty list for nothing stored', () => {
    expect(readStoredWishlist(null)).toEqual([]);
    expect(readStoredWishlist(undefined)).toEqual([]);
    expect(readStoredWishlist('')).toEqual([]);
  });

  it('survives corrupt storage rather than throwing on load', () => {
    // localStorage is user-writable, and a wishlist that cannot be parsed must
    // not take the whole storefront down with it.
    expect(readStoredWishlist('{oh no')).toEqual([]);
    expect(readStoredWishlist('"a string"')).toEqual([]);
    expect(readStoredWishlist('{"id":"' + A + '"}')).toEqual([]);
  });
});
