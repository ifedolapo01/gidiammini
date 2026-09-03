/**
 * COMMERCE layer — the shopper's own browsing history, kept in their browser.
 *
 * Not a recommendation. It is the list of things this person already chose to
 * look at, handed back to them — which is why it converts without any modelling
 * behind it, and why it must never leave the device. Nothing here is sent to
 * the server except the ids, at the moment the rail is rendered, so the store
 * learns what a page needs to draw and not a browsing profile.
 *
 * localStorage rather than a cookie for the same reason: a cookie would be
 * attached to every request whether or not anything wanted it.
 *
 * Pure over an injected storage, so the ordering and capping rules are testable
 * without a browser — and so a page that runs where there is no localStorage
 * degrades to an empty list instead of throwing.
 */

export const RECENTLY_VIEWED_KEY = 'gidiammini.recently-viewed';

/**
 * Long enough to be useful a few products into a session, short enough that the
 * rail is still recent rather than a history page.
 */
export const MAX_RECENTLY_VIEWED = 12;

/** The slice of the Storage API this needs. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The browser's own store, or null where there isn't one.
 *
 * Access itself can throw, not just return null — Safari's private mode and a
 * browser configured to block site data both raise on the property. Callers get
 * null and carry on without a rail.
 */
export function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The ids, most recently viewed first.
 *
 * Anything that is not a list of uuids is discarded rather than repaired. This
 * value is written by an older version of this code, or by hand, and a rail is
 * not worth risking a render over.
 */
export function readRecentlyViewed(storage: StorageLike | null): string[] {
  if (!storage) return [];

  try {
    const raw = storage.getItem(RECENTLY_VIEWED_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((id): id is string => typeof id === 'string' && UUID_PATTERN.test(id))
      .slice(0, MAX_RECENTLY_VIEWED);
  } catch {
    return [];
  }
}

/**
 * Records a view and returns the new list.
 *
 * Re-viewing something moves it to the front rather than adding a duplicate —
 * a rail showing the same product three times is a bug the shopper can see.
 * Returns the list even when the write fails, so the caller can still render
 * from it this session.
 */
export function recordProductView(storage: StorageLike | null, productId: string): string[] {
  if (!UUID_PATTERN.test(productId)) return readRecentlyViewed(storage);

  const next = [productId, ...readRecentlyViewed(storage).filter((id) => id !== productId)].slice(
    0,
    MAX_RECENTLY_VIEWED
  );

  if (storage) {
    try {
      storage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
    } catch {
      // A full or read-only store costs the shopper a rail, nothing more.
    }
  }

  return next;
}

/**
 * What the rail should ask the server for: the history minus the page it is
 * being shown on, since recommending someone the product they are looking at is
 * the one suggestion guaranteed to be useless.
 */
export function recentlyViewedExcluding(ids: string[], excludeId?: string | null): string[] {
  return excludeId ? ids.filter((id) => id !== excludeId) : ids;
}
