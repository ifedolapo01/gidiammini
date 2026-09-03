/**
 * PAYMENTS — the secret key, and whether a webhook really came from Paystack.
 *
 * Split from the API client so it can be tested: paystack.ts carries an
 * `import 'server-only'` guard, and this half needs none — it is crypto over a
 * string and an environment variable, with no network in it.
 *
 * That split is worth having for its own sake. This function is the entire
 * security boundary of the payment integration: anybody can POST to the
 * webhook URL, and this is the only thing between "Paystack says this order is
 * paid" and "a stranger says this order is paid".
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Paystack works in kobo; every amount in this codebase is whole naira. */
export const KOBO_PER_NAIRA = 100;

export function isPaystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY?.trim());
}

export function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set');
  return key;
}

/**
 * Whether this webhook really came from Paystack.
 *
 * HMAC-SHA512 of the *raw* body with the secret key. Raw matters: parsing and
 * re-serialising the JSON changes the bytes and the signature stops matching,
 * which is why the route reads request.text() and hands the string through.
 *
 * Compared in constant time. The comparison is against a value an attacker
 * supplies and can vary freely, which is the textbook case for it.
 */
export function isValidWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;

  const expected = createHmac('sha512', secretKey()).update(rawBody, 'utf8').digest('hex');
  const given = Buffer.from(signature, 'utf8');
  const mine = Buffer.from(expected, 'utf8');

  if (given.length !== mine.length) return false;
  return timingSafeEqual(given, mine);
}
