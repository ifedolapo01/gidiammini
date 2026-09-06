/**
 * The link in the footer of every marketing email.
 *
 * WHY THIS IS NOT A BEARER TOKEN
 *
 * lib/commerce/bearer-token.ts is the right primitive for a sign-in link or a
 * review invite: random, stored as a hash, single-purpose, revocable. It is
 * the wrong one here, for three reasons that all point the same way.
 *
 *   1. An unsubscribe link has to keep working in an email sent two years ago.
 *      A stored token would have to be minted once per subscriber and never
 *      rotated, which is a random string in a column doing the job of a
 *      derivation — or minted per send, which breaks every older email the
 *      moment a newer one goes out. Both are worse than deriving it.
 *   2. It has to be regenerable for every recipient of every campaign without
 *      a write. A blast to 4,000 subscribers should not be 4,000 UPDATEs
 *      before the first message leaves.
 *   3. It grants nothing. The only thing a holder can do is stop mail reaching
 *      an address, which is the outcome the person on that address wants
 *      anyway. The threat model is a nuisance, not a compromise.
 *
 * So: HMAC-SHA256 over the subscriber's id, truncated. Deterministic, stateless,
 * unguessable without the key, and revocable in bulk by rotating the key.
 *
 * DOMAIN SEPARATION
 *
 * The key falls back to SUPABASE_JWT_SECRET so this works on a deployment that
 * has not set anything new — and the message is prefixed with a purpose label,
 * so a value produced here can never be mistaken for, or collide with, a
 * signature produced anywhere else under the same key. Set UNSUBSCRIBE_SECRET
 * to separate them properly.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Bumped if the derivation ever changes, which would invalidate every link in
 *  every email already sent — so it does not change lightly. */
const PURPOSE = 'unsubscribe:v1';

/** 20 bytes of a SHA-256 HMAC, base64url. 27 characters: unguessable, and
 *  short enough that the whole link survives an email client that wraps. */
const TOKEN_BYTES = 20;

function key(): string | null {
  return process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_JWT_SECRET || null;
}

/** True when this deployment can issue links at all. A marketing send with no
 *  key configured must not go out — see the caller. */
export function canSignUnsubscribeLinks(): boolean {
  return key() !== null;
}

/**
 * The token for one subscriber, or null when no secret is configured.
 *
 * Null rather than a throw: the caller's correct response is to refuse to send
 * the campaign, not to crash a cron.
 */
export function unsubscribeToken(subscriberId: string): string | null {
  const secret = key();
  if (!secret) return null;

  return createHmac('sha256', secret)
    .update(`${PURPOSE}:${subscriberId}`, 'utf8')
    .digest()
    .subarray(0, TOKEN_BYTES)
    .toString('base64url');
}

/**
 * Whether `token` is the one for `subscriberId`.
 *
 * Constant-time, unlike the bearer-token lookups elsewhere in the codebase.
 * Those hash what arrived and ask the database whether that hash exists, so
 * there is no secret held in memory to leak through timing. This one does hold
 * one, and recomputes it — so the comparison has to be the careful kind.
 */
export function verifyUnsubscribeToken(subscriberId: string, token: string | null | undefined): boolean {
  if (!token) return false;

  const expected = unsubscribeToken(subscriberId);
  if (!expected) return false;

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(token, 'utf8');
  // timingSafeEqual throws on a length mismatch, which is itself a (harmless)
  // early exit — the length of the expected token is not a secret.
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
