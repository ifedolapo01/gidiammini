/**
 * The webhook signature check.
 *
 * This is the whole security boundary of the payment integration: anybody can
 * POST to the webhook URL, and the only thing separating "Paystack says this
 * order is paid" from "a stranger says this order is paid" is this function.
 *
 * The amount check in payment-finalize.ts is the second line, and it is tested
 * there — but a forged webhook that never gets past the signature never
 * reaches it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { isPaystackConfigured, isValidWebhookSignature, KOBO_PER_NAIRA } from './paystack-signature';

const SECRET = 'sk_test_pretend_secret';
const BODY = JSON.stringify({ event: 'charge.success', data: { reference: 'UT12345678-abcd' } });

const sign = (body: string, secret = SECRET) =>
  createHmac('sha512', secret).update(body, 'utf8').digest('hex');

let previous: string | undefined;

beforeEach(() => {
  previous = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = SECRET;
});

afterEach(() => {
  if (previous === undefined) delete process.env.PAYSTACK_SECRET_KEY;
  else process.env.PAYSTACK_SECRET_KEY = previous;
});

describe('isValidWebhookSignature', () => {
  it('accepts a body signed with the secret key', () => {
    expect(isValidWebhookSignature(BODY, sign(BODY))).toBe(true);
  });

  it('rejects a body that was altered after signing', () => {
    // The attack this exists to stop: take a real webhook and change the
    // amount, or the reference, to point at another order.
    const tampered = BODY.replace('UT12345678', 'UT99999999');
    expect(isValidWebhookSignature(tampered, sign(BODY))).toBe(false);
  });

  it('rejects a signature made with a different key', () => {
    expect(isValidWebhookSignature(BODY, sign(BODY, 'sk_test_someone_else'))).toBe(false);
  });

  it('rejects a missing or empty signature', () => {
    expect(isValidWebhookSignature(BODY, null)).toBe(false);
    expect(isValidWebhookSignature(BODY, '')).toBe(false);
  });

  it('rejects a signature of the wrong length without throwing', () => {
    // timingSafeEqual throws on mismatched lengths, so the guard in front of it
    // is load-bearing: without it a short signature is a 500, not a rejection.
    expect(isValidWebhookSignature(BODY, 'abc')).toBe(false);
    expect(isValidWebhookSignature(BODY, sign(BODY) + '00')).toBe(false);
  });

  it('is sensitive to whitespace, because the raw bytes are what was signed', () => {
    // Why the route reads request.text() and never re-serialises the JSON.
    const reserialised = JSON.stringify(JSON.parse(BODY) as unknown, null, 2);
    expect(isValidWebhookSignature(reserialised, sign(BODY))).toBe(false);
  });
});

describe('configuration', () => {
  it('reports itself unconfigured when the key is absent or blank', () => {
    // Not an error state: the checkout simply does not offer the option, the
    // way SMS reports itself unconfigured rather than pretending to send.
    process.env.PAYSTACK_SECRET_KEY = '';
    expect(isPaystackConfigured()).toBe(false);

    process.env.PAYSTACK_SECRET_KEY = '   ';
    expect(isPaystackConfigured()).toBe(false);

    process.env.PAYSTACK_SECRET_KEY = SECRET;
    expect(isPaystackConfigured()).toBe(true);
  });

  it('knows what a naira is worth in kobo', () => {
    // Every amount in this codebase is whole naira; the provider works in kobo.
    // Getting this backwards charges a hundredth of the order, or a hundred
    // times it.
    expect(KOBO_PER_NAIRA).toBe(100);
    expect(5000 * KOBO_PER_NAIRA).toBe(500000);
  });
});
