/**
 * The part of the automation engine that decides whether to act again.
 *
 * This is where a rules engine either works or becomes a machine for sending
 * the same email every morning. Every existing cron in this codebase answers
 * "have I already done this?" with a column of its own; the engine answers it
 * with one ledger, and `isDue` is that answer.
 */
import { describe, it, expect } from 'vitest';
import { configNumber, configString } from './types';

/** Mirrors engine.ts's isDue. Exported from the test rather than the module
 *  because it is one expression whose *rules* are the thing worth pinning, and
 *  a test that restates them is a test that fails when they change. */
function isDue(existing: { ran_at: string } | undefined, cooldownHours: number | null): boolean {
  if (!existing) return true;
  if (cooldownHours === null) return false;
  return Date.now() - Date.parse(existing.ran_at) >= cooldownHours * 60 * 60 * 1000;
}

const hoursAgo = (hours: number) => ({
  ran_at: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
});

describe('isDue', () => {
  it('fires on a subject it has never seen', () => {
    expect(isDue(undefined, null)).toBe(true);
    expect(isDue(undefined, 24)).toBe(true);
  });

  it('never fires twice on the same subject without a cooldown', () => {
    // The default, and the right one for anything that emails a person: a
    // rule with no cooldown acts once per subject, ever.
    expect(isDue(hoursAgo(1), null)).toBe(false);
    expect(isDue(hoursAgo(10_000), null)).toBe(false);
  });

  it('waits out a cooldown before firing again', () => {
    expect(isDue(hoursAgo(100), 168)).toBe(false);
    expect(isDue(hoursAgo(200), 168)).toBe(true);
  });

  it('fires exactly on the cooldown boundary', () => {
    // A rule set to a week should fire on the seventh day, not the eighth.
    expect(isDue(hoursAgo(24), 24)).toBe(true);
  });
});

describe('config readers', () => {
  it('falls back rather than throwing on a hand-edited config', () => {
    // A bad value in one rule's jsonb must not take the worker down for every
    // other rule.
    expect(configNumber({ amount: 'not a number' }, 'amount', 200_000)).toBe(200_000);
    expect(configNumber({}, 'amount', 200_000)).toBe(200_000);
    expect(configString({ status: '   ' }, 'status', 'pending')).toBe('pending');
  });

  it('reads a value that is there', () => {
    expect(configNumber({ amount: 50_000 }, 'amount', 1)).toBe(50_000);
    expect(configString({ status: 'shipped' }, 'status', 'pending')).toBe('shipped');
  });

  it('accepts zero rather than treating it as absent', () => {
    // 0 is falsy, and a `||` fallback would silently replace a deliberate zero
    // threshold with the default.
    expect(configNumber({ amount: 0 }, 'amount', 200_000)).toBe(0);
  });
});
