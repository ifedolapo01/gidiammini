/**
 * COMMERCE layer — reconciling a browser's wishlist with the account's.
 *
 * The only interesting question in cross-device sync: two lists disagree, and
 * one of them has to win. This one says **neither** — they are unioned.
 *
 * A wishlist is a list of intentions, so an entry appearing on either side is
 * evidence somebody meant it, and there is no timestamp anywhere that could
 * tell a deliberate removal on the laptop from an addition on the phone. A
 * "last write wins" rule would therefore silently delete things people had
 * saved. Union can only ever *keep* something they wanted; the cost of being
 * wrong is one unwanted row they can remove in a tap, rather than a saved
 * product that vanished with no explanation.
 *
 * Removal is explicit and immediate instead: once signed in, un-hearting
 * deletes on the server too, so it does not come back on the next sync.
 *
 * Pure, so the merge is testable without a browser or a database.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How many ids one sync may carry. A wishlist longer than this is not a
 *  wishlist; it is somebody probing the endpoint. */
export const MAX_WISHLIST_IDS = 100;

/**
 * Valid, deduplicated product ids, in the order given.
 *
 * These arrive from localStorage, which is user-writable, so they are input
 * like any other — and a malformed uuid reaching Postgres is a type error
 * rather than an empty result.
 */
export function sanitiseWishlistIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value === 'string' && UUID.test(value)) seen.add(value.toLowerCase());
    if (seen.size >= MAX_WISHLIST_IDS) break;
  }

  return [...seen];
}

/**
 * The union, server entries first.
 *
 * Order matters to the shopper: the server list is what they have curated
 * across devices, and whatever this browser is bringing is newer, so it goes
 * on the end rather than displacing anything.
 */
export function mergeWishlists(serverIds: string[], localIds: string[]): string[] {
  const merged = [...serverIds];
  const known = new Set(serverIds);

  for (const id of localIds) {
    if (!known.has(id)) {
      merged.push(id);
      known.add(id);
    }
  }

  return merged;
}

/** What the browser is bringing that the account has not got. The only rows a
 *  sync needs to write — re-writing what is already there would churn
 *  created_at and reshuffle the list. */
export function idsToAdd(serverIds: string[], localIds: string[]): string[] {
  const known = new Set(serverIds);
  return localIds.filter((id) => !known.has(id));
}
