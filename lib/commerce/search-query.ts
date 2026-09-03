/**
 * COMMERCE layer — normalising what a visitor typed into a search.
 *
 * The database function search_products() does its own sanitising, because that
 * is where a tsquery is actually built and it must not trust anything. This is
 * the client-side half: deciding whether a query is worth sending at all, and
 * producing one canonical form so "Nursing Bra" and " nursing  bra " are the
 * same search — both for the cache and, more usefully, for the query log, where
 * ten spellings of one demand should read as one line.
 *
 * Pure and dependency-free.
 */

/** Below this, a search matches most of the catalogue and means nothing. */
export const MIN_QUERY_LENGTH = 2;

/** Long enough for any real product search; longer is a paste or an attack. */
export const MAX_QUERY_LENGTH = 100;

/**
 * One canonical spelling: lower-cased, punctuation reduced to spaces, runs of
 * whitespace collapsed.
 *
 * Punctuation becomes a space rather than being deleted so "t-shirt" reads as
 * two words, matching how the tsvector indexes it.
 */
export function normaliseSearchQuery(raw: unknown): string {
  if (typeof raw !== 'string') return '';

  return raw
    .slice(0, MAX_QUERY_LENGTH)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Whether this is worth a round trip. */
export function isSearchable(raw: unknown): boolean {
  return normaliseSearchQuery(raw).length >= MIN_QUERY_LENGTH;
}

/** The individual terms, for highlighting a match in the UI. */
export function searchTerms(raw: unknown): string[] {
  const normalised = normaliseSearchQuery(raw);
  return normalised === '' ? [] : normalised.split(' ');
}
