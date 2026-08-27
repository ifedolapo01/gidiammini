/**
 * The pure parts of rate limiting: how a caller is identified, and how keys are
 * built. The counting itself lives in Postgres (check_rate_limit) and was
 * verified against a real database, including 10 concurrent requests against a
 * limit of 4 admitting exactly 4.
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { clientIdentifier, rateLimitKey, type RateLimitRule } from './rate-limit';
import { RATE_LIMITS } from './rate-limit-rules';

const requestWith = (headers: Record<string, string>) =>
  new NextRequest('https://example.com/api/contact', { method: 'POST', headers });

describe('clientIdentifier', () => {
  it('prefers x-real-ip', () => {
    expect(clientIdentifier(requestWith({ 'x-real-ip': '203.0.113.4' }))).toBe('203.0.113.4');
  });

  it('takes the leftmost x-forwarded-for entry — the client, not the proxy', () => {
    expect(clientIdentifier(requestWith({ 'x-forwarded-for': '203.0.113.4, 70.41.3.18, 150.172.238.178' })))
      .toBe('203.0.113.4');
  });

  it('trims whitespace around the address', () => {
    expect(clientIdentifier(requestWith({ 'x-forwarded-for': '  203.0.113.4 , 70.41.3.18' }))).toBe('203.0.113.4');
  });

  it('prefers x-real-ip over x-forwarded-for when both are present', () => {
    const request = requestWith({ 'x-real-ip': '198.51.100.7', 'x-forwarded-for': '203.0.113.4' });
    expect(clientIdentifier(request)).toBe('198.51.100.7');
  });

  it('falls back to a shared bucket rather than skipping the limit', () => {
    // A proxy misconfiguration must not become "no rate limiting at all".
    expect(clientIdentifier(requestWith({}))).toBe('unknown');
  });

  it('treats an empty or whitespace-only header as missing', () => {
    expect(clientIdentifier(requestWith({ 'x-real-ip': '   ' }))).toBe('unknown');
    expect(clientIdentifier(requestWith({ 'x-forwarded-for': ' , ' }))).toBe('unknown');
  });

  it('handles IPv6', () => {
    expect(clientIdentifier(requestWith({ 'x-real-ip': '2001:db8::8a2e:370:7334' }))).toBe('2001:db8::8a2e:370:7334');
  });
});

describe('rateLimitKey', () => {
  it('namespaces the identifier by bucket', () => {
    expect(rateLimitKey('contact', '203.0.113.4')).toBe('contact:203.0.113.4');
  });

  it('keeps different buckets from sharing one budget', () => {
    expect(rateLimitKey('contact', '1.1.1.1')).not.toBe(rateLimitKey('subscribe', '1.1.1.1'));
  });

  it('caps the length, since the key is a primary key', () => {
    const key = rateLimitKey('contact', 'x'.repeat(500));
    expect(key.length).toBeLessThanOrEqual(200);
  });
});

describe('the configured rules', () => {
  // RATE_LIMITS uses `satisfies`, which narrows each entry to its own literal
  // type — good for callers (RATE_LIMITS.contact autocompletes) but it means
  // `failClosed` is absent from the rules that don't set it. Widen for
  // iteration rather than loosening the export.
  const rules = Object.entries(RATE_LIMITS) as [string, RateLimitRule][];

  it('gives every endpoint its own bucket, so budgets never overlap', () => {
    const buckets = rules.map(([, rule]) => rule.bucket);
    expect(new Set(buckets).size).toBe(buckets.length);
  });

  it('uses a positive limit and window everywhere — the SQL rejects anything else', () => {
    for (const [name, rule] of rules) {
      expect(rule.limit, name).toBeGreaterThan(0);
      expect(rule.windowSeconds, name).toBeGreaterThan(0);
    }
  });

  it('fails closed only on the login rules', () => {
    // Everything else needs the database anyway, so refusing on a limiter
    // failure would turn an outage into a worse outage. An unthrottled password
    // guesser is the one case where that trade flips.
    const failClosed = rules.filter(([, r]) => r.failClosed).map(([name]) => name).sort();
    expect(failClosed).toEqual(['loginPerAccount', 'loginPerIp']);
  });

  it('limits the email-sending endpoints most tightly', () => {
    // contact and subscribe both send mail on the store's own quota.
    expect(RATE_LIMITS.contact.limit).toBeLessThanOrEqual(5);
    expect(RATE_LIMITS.subscribe.limit).toBeLessThanOrEqual(5);
  });

  it('keeps order tracking loose enough for a real customer but useless for enumeration', () => {
    const perMinute = RATE_LIMITS.orderTrack.limit / (RATE_LIMITS.orderTrack.windowSeconds / 60);
    expect(perMinute).toBeLessThan(5);
    expect(RATE_LIMITS.orderTrack.limit).toBeGreaterThanOrEqual(10);
  });

  it('gives the login a tighter per-account budget than per-IP, so rotating IPs does not help', () => {
    expect(RATE_LIMITS.loginPerAccount.limit).toBeLessThan(RATE_LIMITS.loginPerIp.limit);
  });
});
