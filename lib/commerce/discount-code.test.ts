/**
 * Whether a code may be used.
 *
 * Every rejection here is money or trust: letting an exhausted code through
 * costs the shop margin it did not agree to, and refusing a valid one costs a
 * sale at the last step of checkout. The cases that matter most are the ones
 * where a plausible implementation gets the *default* wrong — null limits
 * meaning unlimited, and an automatic discount not being enterable as a code.
 */
import { describe, it, expect } from 'vitest';
import { checkDiscountCode, codeSavingsOnLines, normaliseCode } from './discount-code';
import { findFreeShippingDiscount } from './discounts';
import type { Discount } from './discounts';

const NOW = new Date('2026-09-06T12:00:00Z');

const code = (over: Partial<Discount> = {}): Discount => ({
  id: 'd1',
  name: 'Welcome',
  type: 'PERCENTAGE',
  value: 10,
  scope: 'SITEWIDE',
  target_id: null,
  is_active: true,
  start_date: null,
  end_date: null,
  code: 'WELCOME10',
  max_redemptions: null,
  per_customer_limit: null,
  min_order_value: 0,
  redemption_count: 0,
  ...over,
});

const check = (discount: Discount | null, over: { subtotal?: number; timesUsedByCustomer?: number } = {}) =>
  checkDiscountCode({
    discount,
    subtotal: over.subtotal ?? 50_000,
    timesUsedByCustomer: over.timesUsedByCustomer ?? 0,
    now: NOW,
  });

describe('checkDiscountCode', () => {
  it('accepts a live code', () => {
    const result = check(code());
    expect(result.ok).toBe(true);
  });

  it('treats null limits as unlimited, not as zero', () => {
    // The default for every existing discount. Reading null as 0 would refuse
    // every code the moment this shipped.
    const result = check(code({ max_redemptions: null, per_customer_limit: null, redemption_count: 9999 }));
    expect(result.ok).toBe(true);
  });

  it('refuses a code that has hit its ceiling', () => {
    const result = check(code({ max_redemptions: 50, redemption_count: 50 }));
    expect(result).toMatchObject({ ok: false, reason: 'exhausted' });
  });

  it('refuses a customer who has already used their allowance', () => {
    expect(check(code({ per_customer_limit: 1 }), { timesUsedByCustomer: 1 })).toMatchObject({
      ok: false,
      reason: 'already_used',
    });
    // Still inside the allowance.
    expect(check(code({ per_customer_limit: 3 }), { timesUsedByCustomer: 2 }).ok).toBe(true);
  });

  it('says how far off a basket is from the minimum', () => {
    const result = check(code({ min_order_value: 20_000 }), { subtotal: 15_000 });
    expect(result).toMatchObject({ ok: false, reason: 'below_minimum' });
    // The customer can act on this one, so the number has to be in it.
    expect((result as { message: string }).message).toContain('5,000');
  });

  it('accepts a basket exactly on the minimum', () => {
    // "20,000 or more" has to include 20,000, or the offer lies.
    expect(check(code({ min_order_value: 20_000 }), { subtotal: 20_000 }).ok).toBe(true);
  });

  it('respects the schedule at both ends', () => {
    expect(check(code({ start_date: '2026-10-01T00:00:00Z' }))).toMatchObject({
      ok: false,
      reason: 'not_started',
    });
    expect(check(code({ end_date: '2026-09-01T00:00:00Z' }))).toMatchObject({
      ok: false,
      reason: 'expired',
    });
  });

  it('will not let an automatic discount be entered as a code', () => {
    // Somebody typing the name of a running sale. It is already applied, and
    // saying "not recognised" would be a lie they act on.
    const result = check(code({ code: null }));
    expect(result).toMatchObject({ ok: false, reason: 'unknown' });
    expect((result as { message: string }).message).toContain('already applied');
  });

  it('gives an unknown and a switched-off code the same answer', () => {
    // Distinguishing them would confirm to a guesser which codes are real.
    const unknown = check(null) as { message: string };
    const inactive = check(code({ is_active: false })) as { message: string };
    expect(inactive.message).toBe(unknown.message);
  });
});

describe('normaliseCode', () => {
  it('uppercases and trims what a customer types', () => {
    expect(normaliseCode('  welcome10 ')).toBe('WELCOME10');
  });

  it('rejects anything that could not be a code', () => {
    expect(normaliseCode('')).toBeNull();
    expect(normaliseCode('ab')).toBeNull();
    expect(normaliseCode('has space')).toBeNull();
    expect(normaliseCode(null)).toBeNull();
    expect(normaliseCode(42)).toBeNull();
  });

  it('allows the punctuation a real code uses', () => {
    expect(normaliseCode('black-friday_25')).toBe('BLACK-FRIDAY_25');
  });
});

describe('codeSavingsOnLines', () => {
  const lines = [
    { price: 10_000, quantity: 2, eligible: true },
    { price: 5_000, quantity: 1, eligible: false },
  ];

  it('counts only the lines the code applies to', () => {
    // 10% of 10,000 is 1,000, twice. The ineligible line contributes nothing.
    expect(codeSavingsOnLines(code({ value: 10 }), lines)).toBe(2_000);
  });

  it('is zero for a free-shipping code', () => {
    // It takes nothing off a garment; the waived fee is priceOrder's to report.
    expect(codeSavingsOnLines(code({ type: 'FREE_SHIPPING', value: 0 }), lines)).toBe(0);
  });

  it('never discounts a line below nothing', () => {
    const single = [{ price: 800, quantity: 1, eligible: true }];
    expect(codeSavingsOnLines(code({ type: 'FIXED', value: 5_000 }), single)).toBe(800);
  });
});

describe('findFreeShippingDiscount', () => {
  const offer = (over: Partial<Discount> = {}): Discount =>
    code({ type: 'FREE_SHIPPING', value: 0, code: null, scope: 'SITEWIDE', ...over });

  it('applies a standing sitewide offer once the basket qualifies', () => {
    const found = findFreeShippingDiscount([offer({ min_order_value: 20_000 })], 25_000, NOW);
    expect(found?.type).toBe('FREE_SHIPPING');
  });

  it('does not apply below the minimum', () => {
    expect(findFreeShippingDiscount([offer({ min_order_value: 20_000 })], 19_999, NOW)).toBeNull();
  });

  it('ignores a narrower scope rather than guessing what it means', () => {
    // Delivery is charged per order, so "free delivery on the Kids category"
    // has no single honest reading. The form warns rather than silently
    // applying one.
    expect(findFreeShippingDiscount([offer({ scope: 'CATEGORY', target_id: 'kids' })], 50_000, NOW))
      .toBeNull();
  });

  it('leaves a code-gated free-delivery discount to the code path', () => {
    expect(findFreeShippingDiscount([offer({ code: 'SHIPFREE' })], 50_000, NOW)).toBeNull();
  });

  it('respects the switch and the schedule', () => {
    expect(findFreeShippingDiscount([offer({ is_active: false })], 50_000, NOW)).toBeNull();
    expect(findFreeShippingDiscount([offer({ end_date: '2026-09-01T00:00:00Z' })], 50_000, NOW))
      .toBeNull();
  });

  it('picks the highest minimum the basket actually cleared', () => {
    // Both waive the same fee, so the one to report against is the offer they
    // qualified for by spending most.
    const found = findFreeShippingDiscount(
      [offer({ id: 'low', min_order_value: 10_000 }), offer({ id: 'high', min_order_value: 30_000 })],
      50_000,
      NOW
    );
    expect(found?.id).toBe('high');
  });
});
