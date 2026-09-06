/**
 * The unsubscribe link.
 *
 * Worth testing carefully despite being low-stakes: a link that stops working
 * turns an unsubscribe into a spam complaint, and a complaint costs the shop
 * its ability to reach everybody else. So the properties that matter are
 * stability (the same subscriber always gets the same link, in an email sent
 * today or two years ago) and separation (one subscriber's link cannot take
 * another off the list).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  canSignUnsubscribeLinks,
  unsubscribeToken,
  verifyUnsubscribeToken,
} from './unsubscribe-token';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

const saved = {
  unsubscribe: process.env.UNSUBSCRIBE_SECRET,
  jwt: process.env.SUPABASE_JWT_SECRET,
};

beforeEach(() => {
  process.env.UNSUBSCRIBE_SECRET = 'test-secret-value';
  delete process.env.SUPABASE_JWT_SECRET;
});

afterEach(() => {
  if (saved.unsubscribe === undefined) delete process.env.UNSUBSCRIBE_SECRET;
  else process.env.UNSUBSCRIBE_SECRET = saved.unsubscribe;

  if (saved.jwt === undefined) delete process.env.SUPABASE_JWT_SECRET;
  else process.env.SUPABASE_JWT_SECRET = saved.jwt;
});

describe('unsubscribeToken', () => {
  it('is stable for a subscriber', () => {
    // The property the whole design rests on: an email sent two years ago has
    // to keep working without anything stored or rotated.
    expect(unsubscribeToken(A)).toBe(unsubscribeToken(A));
  });

  it('differs per subscriber', () => {
    expect(unsubscribeToken(A)).not.toBe(unsubscribeToken(B));
  });

  it('is URL-safe and short enough to survive a wrapped email', () => {
    const token = unsubscribeToken(A)!;
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeLessThanOrEqual(32);
  });

  it('changes when the secret changes, revoking every link at once', () => {
    const before = unsubscribeToken(A);
    process.env.UNSUBSCRIBE_SECRET = 'a-different-secret';
    expect(unsubscribeToken(A)).not.toBe(before);
  });

  it('falls back to the Supabase secret so a deployment needs no new config', () => {
    delete process.env.UNSUBSCRIBE_SECRET;
    process.env.SUPABASE_JWT_SECRET = 'jwt-secret-value';

    expect(canSignUnsubscribeLinks()).toBe(true);
    expect(unsubscribeToken(A)).toBeTruthy();
  });

  it('returns null rather than throwing when nothing is configured', () => {
    // The caller's correct response is to refuse to send the campaign, which
    // it cannot do if this takes the cron down instead.
    delete process.env.UNSUBSCRIBE_SECRET;
    delete process.env.SUPABASE_JWT_SECRET;

    expect(canSignUnsubscribeLinks()).toBe(false);
    expect(unsubscribeToken(A)).toBeNull();
  });
});

describe('verifyUnsubscribeToken', () => {
  it('accepts the token it issued', () => {
    expect(verifyUnsubscribeToken(A, unsubscribeToken(A))).toBe(true);
  });

  it('refuses another subscriber token', () => {
    // Otherwise one link would be a way to unsubscribe anybody.
    expect(verifyUnsubscribeToken(A, unsubscribeToken(B))).toBe(false);
  });

  it('refuses a missing, empty or truncated token', () => {
    const good = unsubscribeToken(A)!;
    expect(verifyUnsubscribeToken(A, null)).toBe(false);
    expect(verifyUnsubscribeToken(A, '')).toBe(false);
    expect(verifyUnsubscribeToken(A, good.slice(0, -1))).toBe(false);
    expect(verifyUnsubscribeToken(A, good + 'x')).toBe(false);
  });

  it('refuses everything when the secret is gone', () => {
    const good = unsubscribeToken(A)!;
    delete process.env.UNSUBSCRIBE_SECRET;
    delete process.env.SUPABASE_JWT_SECRET;

    expect(verifyUnsubscribeToken(A, good)).toBe(false);
  });
});
