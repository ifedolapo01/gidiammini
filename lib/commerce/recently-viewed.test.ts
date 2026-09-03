import { describe, it, expect } from 'vitest';
import {
  readRecentlyViewed,
  recordProductView,
  recentlyViewedExcluding,
  RECENTLY_VIEWED_KEY,
  MAX_RECENTLY_VIEWED,
  type StorageLike,
} from './recently-viewed';

const id = (n: number) => `3f1a2b4c-5d6e-4f70-8901-a2b3c4d5${String(n).padStart(4, '0')}`;

function memoryStorage(initial?: string): StorageLike & { value: string | null } {
  return {
    value: initial ?? null,
    getItem() {
      return this.value;
    },
    setItem(_key: string, next: string) {
      this.value = next;
    },
  };
}

/** A store that throws on every access, like Safari private mode. */
const hostileStorage: StorageLike = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

describe('readRecentlyViewed', () => {
  it('is empty with no storage and no value', () => {
    expect(readRecentlyViewed(null)).toEqual([]);
    expect(readRecentlyViewed(memoryStorage())).toEqual([]);
  });

  it('reads a stored list', () => {
    const storage = memoryStorage(JSON.stringify([id(1), id(2)]));
    expect(readRecentlyViewed(storage)).toEqual([id(1), id(2)]);
  });

  it('discards junk rather than throwing — the value may be hand-edited', () => {
    expect(readRecentlyViewed(memoryStorage('not json'))).toEqual([]);
    expect(readRecentlyViewed(memoryStorage('{"not":"an array"}'))).toEqual([]);
    expect(readRecentlyViewed(memoryStorage(JSON.stringify(['nope', 42, null])))).toEqual([]);
  });

  it('keeps only the uuid-shaped entries', () => {
    const storage = memoryStorage(JSON.stringify([id(1), 'drop table products', id(2)]));
    expect(readRecentlyViewed(storage)).toEqual([id(1), id(2)]);
  });

  it('survives a storage that throws on access', () => {
    expect(readRecentlyViewed(hostileStorage)).toEqual([]);
  });
});

describe('recordProductView', () => {
  it('puts the newest first', () => {
    const storage = memoryStorage();
    recordProductView(storage, id(1));
    expect(recordProductView(storage, id(2))).toEqual([id(2), id(1)]);
  });

  it('moves a re-view to the front instead of duplicating it', () => {
    const storage = memoryStorage(JSON.stringify([id(1), id(2), id(3)]));
    expect(recordProductView(storage, id(3))).toEqual([id(3), id(1), id(2)]);
  });

  it('caps the list', () => {
    const storage = memoryStorage();
    for (let n = 0; n < MAX_RECENTLY_VIEWED + 5; n++) recordProductView(storage, id(n));

    const stored = readRecentlyViewed(storage);
    expect(stored).toHaveLength(MAX_RECENTLY_VIEWED);
    // The most recent survived; the oldest fell off.
    expect(stored[0]).toBe(id(MAX_RECENTLY_VIEWED + 4));
    expect(stored).not.toContain(id(0));
  });

  it('persists under the documented key', () => {
    const storage = memoryStorage();
    recordProductView(storage, id(1));
    expect(JSON.parse(storage.value as string)).toEqual([id(1)]);
    expect(RECENTLY_VIEWED_KEY).toContain('recently-viewed');
  });

  it('ignores an id that is not a uuid', () => {
    const storage = memoryStorage(JSON.stringify([id(1)]));
    expect(recordProductView(storage, 'nonsense')).toEqual([id(1)]);
  });

  it('still returns the list when the write fails', () => {
    // A full or read-only store costs the shopper a rail, not a render.
    expect(recordProductView(hostileStorage, id(1))).toEqual([id(1)]);
    expect(recordProductView(null, id(1))).toEqual([id(1)]);
  });
});

describe('recentlyViewedExcluding', () => {
  it('drops the product being viewed', () => {
    expect(recentlyViewedExcluding([id(1), id(2)], id(1))).toEqual([id(2)]);
  });

  it('is a no-op without an exclusion', () => {
    expect(recentlyViewedExcluding([id(1)], null)).toEqual([id(1)]);
  });
});
