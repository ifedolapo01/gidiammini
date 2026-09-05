/**
 * COMMERCE layer — matching a phone number somebody half-remembers.
 *
 * The mirror of the orders.customer_phone_digits generated column (migration
 * 20260905160000): both sides strip punctuation and the Nigerian country or
 * trunk prefix, so "0809 653 9067", "+234 809 653 9067" and "8096539067"
 * all reduce to the same digits and match each other.
 *
 * Distinct from normalisePhone() in lib/notifications/phone.ts, which demands a
 * complete, valid mobile number because it is about to hand it to an SMS
 * provider. A search term is usually a fragment off a delivery note, so this
 * one validates nothing — it only canonicalises.
 */

/** Fewer digits than this and a "phone search" is really a text search that
 * happens to contain a number, e.g. an order number or a house number. */
const MIN_SEARCH_DIGITS = 4;

/** The same transform the generated column applies. */
export function phoneSearchDigits(term: string): string {
  return term.replace(/[^0-9]/g, '').replace(/^(00234|234|0)/, '');
}

/**
 * The digits to match against customer_phone_digits, or null when this term is
 * not worth treating as a phone number.
 *
 * Returning null matters: adding a two-digit contains-match to the search would
 * make "12" return most of the order history.
 */
export function phoneSearchTerm(term: string): string | null {
  const digits = phoneSearchDigits(term);
  return digits.length >= MIN_SEARCH_DIGITS ? digits : null;
}
