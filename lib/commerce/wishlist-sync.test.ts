/**
 * Merging two wishlists that disagree.
 *
 * The rule under test is a product decision, not an implementation detail:
 * the union always wins, because nothing in either list records *when* an
 * entry was added or removed. A last-write-wins merge would therefore delete
 * things people had deliberately saved, and they would never find out why.
 */
import { describe, it, expect } from 'vitest';
import {
  idsToAdd,
  mergeWishlists,
  sanitiseWishlistIds,
  MAX_WISHLIST_IDS,
} from './wishlist-sync';

const id = (n: number) => `1111111${n}-1111-4111-8111-111111111111`;

describe('sanitiseWishlistIds', () => {
  it('keeps valid uuids and drops everything else', () => {
    // localStorage is user-writable, so this is untrusted input.
    expect(sanitiseWishlistIds([id(1), 'nonsense', 42, null, id(2)])).toEqual([id(1), id(2)]);
  });

  it('deduplicates, case-insensitively', () => {
    expect(sanitiseWishlistIds([id(1), id(1).toUpperCase()])).toEqual([id(1)]);
  });

  it('caps the list, so the endpoint cannot be used to ask about the catalogue', () => {
    const many = Array.from({ length: MAX_WISHLIST_IDS + 20 }, (_unused, index) =>
      `${String(index).padStart(8, '0')}-1111-4111-8111-111111111111`
    );
    expect(sanitiseWishlistIds(many)).toHaveLength(MAX_WISHLIST_IDS);
  });

  it('answers with an empty list for anything that is not an array', () => {
    expect(sanitiseWishlistIds(undefined)).toEqual([]);
    expect(sanitiseWishlistIds('nope')).toEqual([]);
    expect(sanitiseWishlistIds({ ids: [id(1)] })).toEqual([]);
  });
});

describe('mergeWishlists', () => {
  it('keeps everything from both sides', () => {
    expect(mergeWishlists([id(1), id(2)], [id(2), id(3)])).toEqual([id(1), id(2), id(3)]);
  });

  it('never drops a server entry the browser has not heard of', () => {
    // The phone signing in for the first time must not wipe the laptop's list.
    expect(mergeWishlists([id(1), id(2)], [])).toEqual([id(1), id(2)]);
  });

  it('never drops a local entry the account has not heard of', () => {
    expect(mergeWishlists([], [id(3)])).toEqual([id(3)]);
  });

  it('puts what this browser is bringing on the end', () => {
    // The curated cross-device list keeps its order; the newcomer is appended.
    expect(mergeWishlists([id(1)], [id(9), id(1)])).toEqual([id(1), id(9)]);
  });

  it('is idempotent — syncing twice changes nothing', () => {
    const once = mergeWishlists([id(1)], [id(2)]);
    expect(mergeWishlists(once, [id(2)])).toEqual(once);
  });
});

describe('idsToAdd', () => {
  it('names only what the account is missing', () => {
    // Re-writing existing rows would churn created_at and reshuffle the list.
    expect(idsToAdd([id(1), id(2)], [id(2), id(3)])).toEqual([id(3)]);
  });

  it('writes nothing when the two already agree', () => {
    expect(idsToAdd([id(1)], [id(1)])).toEqual([]);
  });
});
