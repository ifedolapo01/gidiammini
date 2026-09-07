/**
 * The point of the stream split is that a marketing complaint cannot damage
 * order-confirmation delivery. That only holds if the two streams actually
 * resolve to different senders once a marketing address is configured — and it
 * must not break a store that has configured nothing new, which is what the
 * fallback chain is for.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { senderAddress, senderFor, tagsFor } from './email-streams';

const KEYS = [
  'RESEND_FROM_EMAIL',
  'RESEND_MARKETING_FROM_EMAIL',
  'EMAIL_FROM',
  'EMAIL_USER',
] as const;

const ORIGINAL = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

beforeEach(() => {
  for (const key of KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of KEYS) {
    const value = ORIGINAL[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('senderAddress', () => {
  it('prefers the Resend address for transactional mail', () => {
    process.env.RESEND_FROM_EMAIL = 'orders@shop.com';
    process.env.EMAIL_FROM = 'old@gmail.com';
    expect(senderAddress('transactional')).toBe('orders@shop.com');
  });

  it('sends marketing from its own address when one is set', () => {
    process.env.RESEND_FROM_EMAIL = 'orders@shop.com';
    process.env.RESEND_MARKETING_FROM_EMAIL = 'news@mail.shop.com';
    expect(senderAddress('marketing')).toBe('news@mail.shop.com');
    // The whole point: the two streams are different senders.
    expect(senderAddress('transactional')).not.toBe(senderAddress('marketing'));
  });

  it('falls back to the transactional address when no marketing one is set', () => {
    // One sender is the old behaviour, not a regression — the split completes
    // in DNS, not here.
    process.env.RESEND_FROM_EMAIL = 'orders@shop.com';
    expect(senderAddress('marketing')).toBe('orders@shop.com');
  });

  it('falls back through the SMTP variables so an unmigrated store keeps sending', () => {
    process.env.EMAIL_FROM = 'noreply@shop.com';
    expect(senderAddress('transactional')).toBe('noreply@shop.com');

    delete process.env.EMAIL_FROM;
    process.env.EMAIL_USER = 'store@gmail.com';
    expect(senderAddress('transactional')).toBe('store@gmail.com');
  });

  it('treats a whitespace-only value as unset rather than sending from it', () => {
    process.env.RESEND_FROM_EMAIL = '   ';
    process.env.EMAIL_FROM = 'noreply@shop.com';
    expect(senderAddress('transactional')).toBe('noreply@shop.com');
  });

  it('is undefined when nothing is configured', () => {
    expect(senderAddress('transactional')).toBeUndefined();
    expect(senderFor('transactional')).toBeUndefined();
  });
});

describe('senderFor', () => {
  it('attaches the display name', () => {
    process.env.RESEND_FROM_EMAIL = 'orders@shop.com';
    expect(senderFor('transactional')).toBe('"GidiamMini Store" <orders@shop.com>');
  });
});

describe('tagsFor', () => {
  it('labels the stream so the two can be reported on separately', () => {
    expect(tagsFor('marketing')).toEqual([{ name: 'stream', value: 'marketing' }]);
    expect(tagsFor('transactional')).toEqual([{ name: 'stream', value: 'transactional' }]);
  });
});
