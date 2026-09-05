import { describe, expect, it } from 'vitest';
import {
  orderCancelSchema,
  orderEditSchema,
  orderShipmentSchema,
  refundCreateSchema,
  refundSettleSchema,
} from './admin-orders';

const line = (overrides: Record<string, unknown> = {}) => ({
  product_id: '11111111-1111-4111-8111-111111111111',
  product_name: 'Cotton Gown',
  price: 5_000,
  quantity: 2,
  size: '0-3m',
  color: 'Red',
  ...overrides,
});

describe('orderEditSchema', () => {
  it('accepts a well-formed edit', () => {
    const parsed = orderEditSchema.parse({ items: [line()] });

    expect(parsed.items[0].product_id).toBe('11111111-1111-4111-8111-111111111111');
    // Not mentioned means "leave the customer notified", which is the safe
    // default for a change to what they are paying for.
    expect(parsed.notify).toBe(true);
  });

  it('refuses an empty order, because emptying one is a cancellation', () => {
    const result = orderEditSchema.safeParse({ items: [] });

    expect(result.success).toBe(false);
  });

  it('allows a line with no product id, so a deleted product stays editable', () => {
    const parsed = orderEditSchema.parse({ items: [line({ product_id: null })] });

    expect(parsed.items[0].product_id).toBeNull();
  });

  it('refuses a fractional price — every price column here is an integer', () => {
    expect(orderEditSchema.safeParse({ items: [line({ price: 5_000.5 })] }).success).toBe(false);
  });

  it('refuses a zero or negative quantity', () => {
    expect(orderEditSchema.safeParse({ items: [line({ quantity: 0 })] }).success).toBe(false);
    expect(orderEditSchema.safeParse({ items: [line({ quantity: -1 })] }).success).toBe(false);
  });

  it('accepts a price of zero — a replacement sent at no charge is a real line', () => {
    expect(orderEditSchema.safeParse({ items: [line({ price: 0 })] }).success).toBe(true);
  });

  it('keeps "no discount mentioned" distinct from "discount of zero"', () => {
    // The SQL treats null as "leave it alone" and 0 as "clear it", so the
    // schema must not collapse the two.
    expect(orderEditSchema.parse({ items: [line()] }).discount_amount).toBeUndefined();
    expect(orderEditSchema.parse({ items: [line()], discount_amount: 0 }).discount_amount).toBe(0);
  });

  it('strips anything the request did not name', () => {
    const parsed = orderEditSchema.parse({
      items: [line({ total_amount: 999_999 })],
      total_amount: 1,
    }) as Record<string, unknown>;

    expect(parsed).not.toHaveProperty('total_amount');
    expect(parsed.items).toEqual([expect.not.objectContaining({ total_amount: expect.anything() })]);
  });

  it('caps the number of lines', () => {
    const many = Array.from({ length: 51 }, () => line());

    expect(orderEditSchema.safeParse({ items: many }).success).toBe(false);
  });
});

describe('orderCancelSchema', () => {
  it('requires a ground from the fixed list', () => {
    expect(orderCancelSchema.safeParse({}).success).toBe(false);
    expect(orderCancelSchema.safeParse({ reason_code: 'because' }).success).toBe(false);
    expect(orderCancelSchema.safeParse({ reason_code: 'out_of_stock' }).success).toBe(true);
  });

  it('leaves the free-text note optional and normalises an absent one', () => {
    expect(orderCancelSchema.parse({ reason_code: 'out_of_stock' }).reason).toBe('');
  });

  it('caps the note rather than letting an unbounded string through', () => {
    const result = orderCancelSchema.safeParse({
      reason_code: 'other',
      reason: 'x'.repeat(5_000),
    });

    expect(result.success).toBe(false);
  });
});

describe('orderShipmentSchema', () => {
  it('accepts a shipment with nothing on it — the shop’s own rider has no waybill', () => {
    expect(orderShipmentSchema.parse({})).toEqual({
      carrier: '',
      tracking_number: '',
      tracking_url: '',
    });
  });

  it('caps a pasted tracking link rather than storing an unbounded string', () => {
    expect(
      orderShipmentSchema.safeParse({ tracking_url: `https://x.test/${'a'.repeat(600)}` }).success
    ).toBe(false);
  });
});

describe('refundCreateSchema', () => {
  const valid = { amount: 5_000, reason_code: 'item_faulty' };

  it('accepts a refund with a ground and an amount', () => {
    const parsed = refundCreateSchema.parse(valid);

    expect(parsed.method).toBe('transfer');
    // Agreed but not yet sent, which is the honest default for a transfer.
    expect(parsed.settled).toBe(false);
    expect(parsed.notify).toBe(true);
  });

  it('allows kobo — half of an odd total is not a whole Naira', () => {
    expect(refundCreateSchema.parse({ ...valid, amount: 2_250.5 }).amount).toBe(2_250.5);
  });

  it('refuses a refund of nothing', () => {
    expect(refundCreateSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
    expect(refundCreateSchema.safeParse({ ...valid, amount: -100 }).success).toBe(false);
  });

  it('requires a ground', () => {
    expect(refundCreateSchema.safeParse({ amount: 100 }).success).toBe(false);
    expect(refundCreateSchema.safeParse({ ...valid, reason_code: 'felt_like_it' }).success).toBe(false);
  });

  it('refuses a method the database would refuse', () => {
    expect(refundCreateSchema.safeParse({ ...valid, method: 'bitcoin' }).success).toBe(false);
  });
});

describe('refundSettleSchema', () => {
  it('takes only the two outcomes a pending refund can reach', () => {
    expect(refundSettleSchema.safeParse({ outcome: 'completed' }).success).toBe(true);
    expect(refundSettleSchema.safeParse({ outcome: 'failed' }).success).toBe(true);
    // 'pending' would be reopening a settled refund, which the trigger refuses.
    expect(refundSettleSchema.safeParse({ outcome: 'pending' }).success).toBe(false);
  });
});
