/**
 * COMMERCE layer — reading a wishlist out of the browser, in either shape.
 *
 * The wishlist stored whole product objects until it stored ids, and both
 * shapes exist in the wild: every visitor with a saved list is carrying the old
 * one until the first time this runs. Converting on read means nobody's list
 * disappears on the deploy that changed the format, and there is no migration
 * to remember to delete later — the old shape simply stops appearing.
 *
 * Pure, so both shapes can be tested without a browser.
 */
import { sanitiseWishlistIds } from './wishlist-sync';

export const WISHLIST_STORAGE_KEY = 'gidiammini_wishlist';

/**
 * The saved product ids, from either the current shape (an array of ids) or
 * the old one (an array of product objects). Anything else — absent, corrupt,
 * a shape from neither era — reads as an empty list, which is what it would
 * have done before.
 *
 * The ids run through the same validation the sync endpoint applies, so a
 * hand-edited localStorage cannot put a non-uuid into a request.
 */
export function readStoredWishlist(raw: string | null | undefined): string[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('Could not parse the saved wishlist; starting empty.');
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const ids = parsed.map((entry) =>
    typeof entry === 'string'
      ? entry
      : // The old shape: { id, name, price, stock, … }. Only the id survives,
        // which is the whole point — the rest was a snapshot going stale.
        (entry as { id?: unknown } | null)?.id
  );

  return sanitiseWishlistIds(ids);
}
