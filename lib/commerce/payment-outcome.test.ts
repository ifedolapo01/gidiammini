import { describe, expect, it } from 'vitest';
import {
  MONEY_EPSILON,
  daysWaiting,
  round2,
  settlement,
  suggestOutcome,
} from './payment-outcome';

describe('settlement', () => {
  it('reports an order paid in full as settled with nothing outstanding', () => {
    const result = settlement(20_000, 20_000);

    expect(result.settled).toBe(true);
    expect(result.partial).toBe(false);
    expect(result.outstanding).toBe(0);
    expect(result.overpaid).toBe(0);
  });

  it('reports a part payment as partial, with the balance owing', () => {
    const result = settlement(20_000, 18_000);

    expect(result.settled).toBe(false);
    expect(result.partial).toBe(true);
    expect(result.outstanding).toBe(2_000);
  });

  it('is not partial when nothing at all has arrived', () => {
    // The distinction matters: "part paid" is a balance to chase, "unpaid" is
    // a receipt to verify, and the worklist counts them as separate jobs.
    expect(settlement(20_000, 0).partial).toBe(false);
  });

  it('never reports a negative balance on an overpayment', () => {
    const result = settlement(20_000, 20_500);

    expect(result.outstanding).toBe(0);
    expect(result.settled).toBe(true);
    expect(result.overpaid).toBe(500);
  });

  it('treats a floating-point shortfall inside the epsilon as settled', () => {
    // The case this exists for: a total computed from unit prices plus
    // shipping can land a fraction of a kobo above the sum received, which is
    // a balance no customer can pay.
    const result = settlement(20_000.0000001, 20_000);

    expect(result.settled).toBe(true);
    expect(result.outstanding).toBe(0);
  });

  it('still reports a shortfall larger than the epsilon', () => {
    expect(settlement(20_000, 20_000 - MONEY_EPSILON * 4).settled).toBe(false);
  });
});

describe('suggestOutcome', () => {
  it('suggests verified when the amount clears the order', () => {
    expect(suggestOutcome(20_000, 0, 20_000)).toBe('verified');
  });

  it('suggests verified when a top-up clears an existing balance', () => {
    expect(suggestOutcome(20_000, 18_000, 2_000)).toBe('verified');
  });

  it('suggests short paid when the amount leaves a balance', () => {
    expect(suggestOutcome(20_000, 0, 18_000)).toBe('short_paid');
  });

  it('does not suggest verified for a zero or negative amount', () => {
    expect(suggestOutcome(20_000, 20_000, 0)).toBe('short_paid');
  });
});

describe('round2', () => {
  it('keeps naira to the kobo', () => {
    expect(round2(1999.999)).toBe(2000);
    expect(round2(0.005)).toBe(0.01);
  });
});

describe('daysWaiting', () => {
  const now = new Date('2026-09-05T12:00:00Z');

  it('counts whole days only', () => {
    expect(daysWaiting('2026-09-05T09:00:00Z', now)).toBe(0);
    expect(daysWaiting('2026-09-04T09:00:00Z', now)).toBe(1);
    expect(daysWaiting('2026-09-01T09:00:00Z', now)).toBe(4);
  });

  it('never reports a negative wait for a future timestamp', () => {
    expect(daysWaiting('2026-09-09T09:00:00Z', now)).toBe(0);
  });
});
