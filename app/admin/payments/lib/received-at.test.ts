import { describe, expect, it } from 'vitest';
import { toReceivedAt, todayInputValue } from './received-at';

describe('toReceivedAt', () => {
  it('keeps the time of day when the date chosen is today', () => {
    const before = Date.now();
    const instant = new Date(toReceivedAt(todayInputValue())).getTime();

    expect(instant).toBeGreaterThanOrEqual(before - 1000);
    expect(instant).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('anchors an earlier date at local midday, so no offset moves the day', () => {
    // The bug this guards: new Date('2026-09-01') is midnight UTC, which in a
    // timezone behind UTC is 31 August — a payment filed under the wrong day
    // does not reconcile against a statement.
    const recorded = new Date(toReceivedAt('2026-09-01'));

    expect(recorded.getFullYear()).toBe(2026);
    expect(recorded.getMonth()).toBe(8);
    expect(recorded.getDate()).toBe(1);
    expect(recorded.getHours()).toBe(12);
  });

  it('falls back to now for an empty or unparseable value', () => {
    for (const value of ['', 'not-a-date']) {
      const instant = new Date(toReceivedAt(value)).getTime();
      expect(Number.isNaN(instant)).toBe(false);
    }
  });
});

describe('todayInputValue', () => {
  it('produces a value a date input accepts', () => {
    expect(todayInputValue()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('is the operator’s own local date, not the UTC one', () => {
    const now = new Date();
    const expected = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');

    expect(todayInputValue()).toBe(expected);
  });
});
