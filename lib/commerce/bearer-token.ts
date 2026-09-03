/**
 * COMMERCE layer — the unguessable-string primitive behind every passwordless
 * credential in this shop.
 *
 * Two features need the same thing: a review invite that proves somebody
 * bought an order, and a sign-in link that proves somebody controls an email
 * address. Both are bearer tokens — whoever holds the string is treated as the
 * person — so both need identical properties, and having two implementations
 * would mean one of them eventually gets the weaker one:
 *
 *   * Generated from a CSPRNG, never derived from anything about the customer.
 *     An order number is "UT" plus a truncated timestamp; derive from that and
 *     the credential is guessable.
 *   * Only the SHA-256 hash is stored. A dump of the table is not a set of
 *     working credentials.
 *   * Hashed here, in Node, and not in SQL. `digest()` lives in the
 *     `extensions` schema on hosted Supabase and does not resolve from the
 *     search_path a migration runs under — a lesson already paid for once and
 *     encoded in migration-conventions.test.ts.
 *
 * Lookup is an equality match on the stored hash, which is a unique index. No
 * constant-time comparison is needed: the server never holds a secret to
 * compare against, it hashes what arrived and asks the database whether that
 * hash exists.
 */
import { createHash, randomBytes } from 'node:crypto';

/** 32 bytes of entropy. Long enough that guessing is not a strategy, short
 *  enough that the URL survives being pasted into WhatsApp. */
const TOKEN_BYTES = 32;

/** base64url of 32 bytes is 43 characters. Checked before a database round
 *  trip, so a crawler poking /review/foo or /account/verify?token=foo costs
 *  nothing. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{40,64}$/;

export function newBearerToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashBearerToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** True when the string could be one of our tokens at all. */
export function isBearerTokenShape(token: string | null | undefined): boolean {
  return typeof token === 'string' && TOKEN_SHAPE.test(token);
}
