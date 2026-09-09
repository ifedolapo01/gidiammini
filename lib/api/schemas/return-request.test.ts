/**
 * The public return-request schema — split out of orderChangeRequestSchema
 * now that a return is its own resource. See lib/commerce/returns.ts.
 */
import { describe, it, expect } from 'vitest';
import { createReturnSchema } from './return-request';

const errorFields = (input: unknown): string[] => {
  const result = createReturnSchema.safeParse(input);
  expect(result.success, 'expected this input to be rejected').toBe(false);
  return result.error!.issues.map((i) => i.path.join('.') || '_');
};

const parsed = (input: unknown) => {
  const result = createReturnSchema.safeParse(input);
  expect(result.success, `expected this input to parse: ${JSON.stringify(result.error?.issues)}`).toBe(true);
  return result.data!;
};

const base = { orderNumber: 'UT12345678', contact: 'a@b.co' };

describe('createReturnSchema', () => {
  it('accepts a return naming its items and why', () => {
    const result = parsed({
      ...base,
      reason: 'Wrong size arrived',
      items: [{ orderItemId: 'item-1', quantity: 2 }],
    });
    expect(result.items).toEqual([{ orderItemId: 'item-1', quantity: 2 }]);
    expect(result.reason).toBe('Wrong size arrived');
  });

  it('strips the leading # a customer pastes from their confirmation email', () => {
    expect(parsed({ ...base, orderNumber: '#UT12345678', reason: 'x', items: [{ orderItemId: 'i', quantity: 1 }] }).orderNumber)
      .toBe('UT12345678');
  });

  it('requires at least one item', () => {
    expect(errorFields({ ...base, reason: 'x', items: [] })).toEqual(['items']);
  });

  it('requires a reason', () => {
    expect(errorFields({ ...base, reason: '', items: [{ orderItemId: 'i', quantity: 1 }] })).toEqual(['reason']);
  });

  it('rejects a quantity outside the accepted range', () => {
    expect(errorFields({ ...base, reason: 'x', items: [{ orderItemId: 'i', quantity: 0 }] }))
      .toEqual(['items.0.quantity']);
    expect(errorFields({ ...base, reason: 'x', items: [{ orderItemId: 'i', quantity: 100 }] }))
      .toEqual(['items.0.quantity']);
  });

  it('drops any extra key a client sends on a line — the schema is an allowlist', () => {
    const result = parsed({
      ...base,
      reason: 'x',
      items: [{ orderItemId: 'item-1', quantity: 1, price: 5000 }],
    });
    expect(result.items[0]).toEqual({ orderItemId: 'item-1', quantity: 1 });
  });
});
