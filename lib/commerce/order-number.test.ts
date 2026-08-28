/**
 * Order number issuing — the pure parts. The sequence and reservation logic
 * live in Postgres (reserve_order_number) and were verified against a real
 * database, including 12 concurrent calls with the same key yielding exactly
 * one number.
 */
import { describe, it, expect } from 'vitest';
import { isValidIdempotencyKey, ORDER_NUMBER_PATTERN } from './order-number';

describe('isValidIdempotencyKey', () => {
  it('accepts a UUID as crypto.randomUUID() produces it', () => {
    expect(isValidIdempotencyKey('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true);
  });

  it('accepts uppercase and surrounding whitespace', () => {
    expect(isValidIdempotencyKey('3F2504E0-4F89-41D3-9A0C-0305E82C3301')).toBe(true);
    expect(isValidIdempotencyKey('  3f2504e0-4f89-41d3-9a0c-0305e82c3301  ')).toBe(true);
  });

  it('rejects anything that is not a UUID', () => {
    // The key reaches a uuid column, so a bad value must be caught before the
    // round trip rather than surfacing as a Postgres cast error.
    for (const bad of [
      '', '   ', 'not-a-uuid', '3f2504e0', '3f2504e04f8941d39a0c0305e82c3301',
      '3f2504e0-4f89-41d3-9a0c-0305e82c330', '3f2504e0-4f89-41d3-9a0c-0305e82c33011',
      'zzzzzzzz-4f89-41d3-9a0c-0305e82c3301',
      null, undefined, 42, {}, [],
    ]) {
      expect(isValidIdempotencyKey(bad), String(bad)).toBe(false);
    }
  });
});

describe('ORDER_NUMBER_PATTERN', () => {
  it('matches what reserve_order_number produces', () => {
    expect(ORDER_NUMBER_PATTERN.test('UT00100000')).toBe(true);
    expect(ORDER_NUMBER_PATTERN.test('UT99999999')).toBe(true);
  });

  it('still matches the legacy timestamp-derived numbers already in the database', () => {
    // Existing production orders: UT10595593, UT24445514, UT88478504.
    for (const legacy of ['UT10595593', 'UT24445514', 'UT88478504']) {
      expect(ORDER_NUMBER_PATTERN.test(legacy), legacy).toBe(true);
    }
  });

  it('rejects the wrong shape', () => {
    for (const bad of ['UT1', 'UT001000000', 'XX00100000', 'ut00100000', '00100000', 'UT0010000A']) {
      expect(ORDER_NUMBER_PATTERN.test(bad), bad).toBe(false);
    }
  });
});
