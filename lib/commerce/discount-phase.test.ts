/**
 * Discount lifecycle phases decide when the cron emails your whole subscriber
 * list. Getting a boundary wrong means either silence or a duplicate blast.
 *
 * Note the two functions differ deliberately: the cron variant only treats a
 * discount as STARTING_SOON inside 24 hours, while the storefront banner covers
 * the whole pre-start window.
 */
import { describe, it, expect } from 'vitest';
import { computeDiscountPhase, computeStorefrontDiscountPhase, formatTimeDiff } from './discount-phase';

const NOW = new Date('2026-08-27T12:00:00Z');
const at = (offsetHours: number) => new Date(NOW.getTime() + offsetHours * 3_600_000).toISOString();
const DAY = 24;

describe('computeDiscountPhase (cron: should we email?)', () => {
  it('is STARTING_SOON within 24 hours of the start', () => {
    expect(computeDiscountPhase({ start_date: at(6) }, NOW)).toBe('STARTING_SOON');
    expect(computeDiscountPhase({ start_date: at(23) }, NOW)).toBe('STARTING_SOON');
  });

  it('is NONE when the start is more than 24 hours away', () => {
    // The whole point of the cron variant: it must not email a week early.
    expect(computeDiscountPhase({ start_date: at(48) }, NOW)).toBe('NONE');
  });

  it('is DAY_1 for an open-ended discount that has started', () => {
    expect(computeDiscountPhase({ start_date: at(-1), end_date: null }, NOW)).toBe('DAY_1');
  });

  it('is DAY_1 on the first day of a dated run', () => {
    expect(computeDiscountPhase({ start_date: at(-2), end_date: at(5 * DAY) }, NOW)).toBe('DAY_1');
  });

  it('is LAST_DAY on the final day of a multi-day run', () => {
    // A 5-day run started 4 days ago: today is day 5.
    expect(computeDiscountPhase({ start_date: at(-4 * DAY), end_date: at(DAY) }, NOW)).toBe('LAST_DAY');
  });

  it('never reports LAST_DAY for a single-day run — that is DAY_1', () => {
    expect(computeDiscountPhase({ start_date: at(-1), end_date: at(2) }, NOW)).toBe('DAY_1');
  });

  it('is MIDDLE_DAY only for runs of five days or more', () => {
    // 7-day run, 3 days in -> middle.
    expect(computeDiscountPhase({ start_date: at(-3 * DAY), end_date: at(4 * DAY) }, NOW)).toBe('MIDDLE_DAY');
    // 4-day run, 1 day in -> no middle-day email for a short run.
    expect(computeDiscountPhase({ start_date: at(-1 * DAY), end_date: at(3 * DAY) }, NOW)).toBe('NONE');
  });

  it('is NONE on an ordinary in-between day', () => {
    // 10-day run, 2 days in: not day 1, not the middle, not the last.
    expect(computeDiscountPhase({ start_date: at(-2 * DAY), end_date: at(8 * DAY) }, NOW)).toBe('NONE');
  });

  it('treats a missing start date as "starts now"', () => {
    expect(computeDiscountPhase({ start_date: null, end_date: null }, NOW)).toBe('DAY_1');
  });
});

describe('computeStorefrontDiscountPhase (banner: what do we show?)', () => {
  it('is STARTING_SOON for the whole pre-start window, unlike the cron variant', () => {
    const far = { start_date: at(30 * DAY) };
    expect(computeStorefrontDiscountPhase(far, NOW).phase).toBe('STARTING_SOON');
    expect(computeDiscountPhase(far, NOW)).toBe('NONE');
  });

  it('always asks for the banner to show', () => {
    expect(computeStorefrontDiscountPhase({ start_date: at(-1) }, NOW).showBanner).toBe(true);
    expect(computeStorefrontDiscountPhase({ start_date: at(999) }, NOW).showBanner).toBe(true);
  });

  it('agrees with the cron variant once the discount is running', () => {
    const live = { start_date: at(-4 * DAY), end_date: at(DAY) };
    expect(computeStorefrontDiscountPhase(live, NOW).phase).toBe('LAST_DAY');
    expect(computeDiscountPhase(live, NOW)).toBe('LAST_DAY');
  });
});

describe('formatTimeDiff', () => {
  it('shows days, hours and minutes for long spans', () => {
    expect(formatTimeDiff((2 * 24 * 60 + 4 * 60 + 30) * 60_000)).toBe('2d 4h 30m');
  });

  it('drops the day part under 24 hours', () => {
    expect(formatTimeDiff((1 * 3600 + 5 * 60 + 20) * 1000)).toBe('1h 5m 20s');
  });

  it('drops the hour part under an hour', () => {
    expect(formatTimeDiff((3 * 60 + 10) * 1000)).toBe('3m 10s');
  });

  it('handles zero without producing something odd', () => {
    expect(formatTimeDiff(0)).toBe('0m 0s');
  });
});
