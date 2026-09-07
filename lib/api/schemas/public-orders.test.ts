/**
 * The public order request schemas.
 *
 * These tests care about two things above all: that a body carrying extra keys
 * has them *removed* rather than passed through (the schema strip is the
 * allowlist that stops mass assignment), and that a wrong-typed field produces
 * a named field error rather than sailing past a truthiness check and throwing
 * later.
 */
import { describe, it, expect } from 'vitest';
import { trackOrderSchema, createOrderSchema, checkoutQuoteSchema } from './public-orders';
import { orderChangeRequestSchema } from './order-change-request';

/** The field paths a failed parse complained about. */
const errorFields = (schema: { safeParse: (v: unknown) => any }, input: unknown): string[] => {
  const result = schema.safeParse(input);
  expect(result.success, 'expected this input to be rejected').toBe(false);
  return result.error.issues.map((i: any) => i.path.join('.') || '_');
};

const parsed = <T>(schema: { safeParse: (v: unknown) => any }, input: unknown): T => {
  const result = schema.safeParse(input);
  expect(result.success, `expected this input to parse: ${JSON.stringify(result.error?.issues)}`).toBe(true);
  return result.data;
};

describe('trackOrderSchema', () => {
  it('trims and strips the # customers paste from their confirmation', () => {
    expect(parsed(trackOrderSchema, { orderNumber: '  #UT12345678 ', contact: 'a@b.co' }))
      .toEqual({ orderNumber: 'UT12345678', contact: 'a@b.co' });
  });

  it('rejects a non-string order number by name instead of throwing later', () => {
    // This is the case that used to reach .trim() and answer with a 500.
    expect(errorFields(trackOrderSchema, { orderNumber: 123, contact: 'a@b.co' }))
      .toEqual(['orderNumber']);
    expect(errorFields(trackOrderSchema, { orderNumber: { a: 1 }, contact: 'a@b.co' }))
      .toEqual(['orderNumber']);
  });

  it('treats a whitespace-only value as missing', () => {
    expect(errorFields(trackOrderSchema, { orderNumber: '   ', contact: 'a@b.co' }))
      .toEqual(['orderNumber']);
  });

  it('names every missing field at once', () => {
    expect(errorFields(trackOrderSchema, {}).sort()).toEqual(['contact', 'orderNumber']);
  });

  it('rejects a non-object body', () => {
    for (const body of [null, undefined, 'a string', 42, []]) {
      expect(errorFields(trackOrderSchema, body).length).toBeGreaterThan(0);
    }
  });

  it('caps an absurdly long order number', () => {
    expect(errorFields(trackOrderSchema, { orderNumber: 'U'.repeat(500), contact: 'a@b.co' }))
      .toEqual(['orderNumber']);
  });
});

describe('orderChangeRequestSchema — details is an allowlist, not a passthrough', () => {
  const base = { orderNumber: 'UT12345678', contact: 'a@b.co' };

  it('keeps only preferredDate on a reschedule', () => {
    // The extra keys here would previously have been stored in the jsonb column.
    const result = parsed<any>(orderChangeRequestSchema, {
      ...base,
      requestType: 'reschedule',
      details: { preferredDate: '2026-10-01', injected: 'evil', status: 'approved' },
    });
    expect(result.details).toEqual({ preferredDate: '2026-10-01' });
  });

  it('drops everything on a cancel', () => {
    const result = parsed<any>(orderChangeRequestSchema, {
      ...base,
      requestType: 'cancel',
      details: { newDeliveryOption: 'pickup', anything: 1 },
    });
    expect(result.details).toEqual({});
  });

  it('accepts a cancel with no details at all', () => {
    expect(parsed<any>(orderChangeRequestSchema, { ...base, requestType: 'cancel' }).details).toEqual({});
  });

  it('keeps only the delivery option when switching to pickup', () => {
    const result = parsed<any>(orderChangeRequestSchema, {
      ...base,
      requestType: 'delivery_method_change',
      details: { newDeliveryOption: 'pickup', deliveryAddress: 'ignored', city: 'ignored' },
    });
    expect(result.details).toEqual({ newDeliveryOption: 'pickup' });
  });

  it('requires an address and city when switching to delivery', () => {
    expect(errorFields(orderChangeRequestSchema, {
      ...base,
      requestType: 'delivery_method_change',
      details: { newDeliveryOption: 'delivery' },
    }).sort()).toEqual(['details.city', 'details.deliveryAddress']);
  });

  it('rejects an unknown delivery option', () => {
    expect(errorFields(orderChangeRequestSchema, {
      ...base,
      requestType: 'delivery_method_change',
      details: { newDeliveryOption: 'teleport' },
    })).toEqual(['details.newDeliveryOption']);
  });

  it('rejects an unknown request type', () => {
    expect(errorFields(orderChangeRequestSchema, { ...base, requestType: 'refund_everything' }))
      .toEqual(['requestType']);
  });

  it('strips extra top-level keys', () => {
    const result = parsed<any>(orderChangeRequestSchema, {
      ...base,
      requestType: 'cancel',
      status: 'approved',
      admin_response: 'sure',
      order_id: 'someone-elses-order',
    });
    expect(Object.keys(result).sort()).toEqual(['contact', 'customerNote', 'details', 'orderNumber', 'requestType']);
  });

  it('caps the customer note', () => {
    expect(errorFields(orderChangeRequestSchema, {
      ...base,
      requestType: 'cancel',
      customerNote: 'x'.repeat(5000),
    })).toEqual(['customerNote']);
  });

  it('defaults an absent note to an empty string', () => {
    expect(parsed<any>(orderChangeRequestSchema, { ...base, requestType: 'cancel' }).customerNote).toBe('');
  });

  it('keeps only newAddress and city on an address correction', () => {
    const result = parsed<any>(orderChangeRequestSchema, {
      ...base,
      requestType: 'address_correction',
      details: { newAddress: '12 Example Close', city: 'Abuja', status: 'approved' },
    });
    expect(result.details).toEqual({ newAddress: '12 Example Close', city: 'Abuja' });
  });

  it('requires newAddress on an address correction', () => {
    expect(errorFields(orderChangeRequestSchema, {
      ...base,
      requestType: 'address_correction',
      details: {},
    })).toEqual(['details.newAddress']);
  });

  it('accepts an item swap naming only the product it is on the order for', () => {
    const result = parsed<any>(orderChangeRequestSchema, {
      ...base,
      requestType: 'item_swap',
      details: { productId: 'prod-1', newSize: '6-9m' },
    });
    expect(result.details).toEqual({ productId: 'prod-1', newSize: '6-9m', newColor: '' });
  });

  it('requires a productId on an item swap', () => {
    expect(errorFields(orderChangeRequestSchema, {
      ...base,
      requestType: 'item_swap',
      details: { newSize: '6-9m' },
    })).toEqual(['details.productId']);
  });

  it('coerces and caps the quantity on an add-item request', () => {
    const result = parsed<any>(orderChangeRequestSchema, {
      ...base,
      requestType: 'add_item',
      details: { productId: 'prod-1', quantity: '2' },
    });
    expect(result.details.quantity).toBe(2);
  });

  it('rejects a quantity outside the accepted range', () => {
    expect(errorFields(orderChangeRequestSchema, {
      ...base,
      requestType: 'add_item',
      details: { productId: 'prod-1', quantity: 0 },
    })).toEqual(['details.quantity']);

    expect(errorFields(orderChangeRequestSchema, {
      ...base,
      requestType: 'add_item',
      details: { productId: 'prod-1', quantity: 21 },
    })).toEqual(['details.quantity']);
  });

  it('requires at least one item and a reason on a return request', () => {
    expect(errorFields(orderChangeRequestSchema, {
      ...base,
      requestType: 'return_request',
      details: { orderItemIds: [], reason: '' },
    }).sort()).toEqual(['details.orderItemIds', 'details.reason']);
  });

  it('accepts a return request naming the items and why', () => {
    const result = parsed<any>(orderChangeRequestSchema, {
      ...base,
      requestType: 'return_request',
      details: { orderItemIds: ['item-1', 'item-2'], reason: 'Wrong size arrived' },
    });
    expect(result.details).toEqual({ orderItemIds: ['item-1', 'item-2'], reason: 'Wrong size arrived' });
  });

  it('requires a date on a hold-until request', () => {
    expect(errorFields(orderChangeRequestSchema, {
      ...base,
      requestType: 'hold_until',
      details: {},
    })).toEqual(['details.holdUntilDate']);
  });
});

describe('createOrderSchema', () => {
  const valid = {
    idempotency_key: '11111111-1111-4111-8111-111111111111',
    customer_name: 'Ada',
    customer_email: 'ada@example.com',
    customer_phone: '08096539067',
    items: [{ product_id: 'p1', quantity: 1 }],
  };

  it('strips fields that would otherwise set order columns', () => {
    const result = parsed<any>(createOrderSchema, {
      ...valid,
      status: 'confirmed',
      payment_verified: true,
      total_amount: 1,
      order_number: 'UT00000001',
      stock_reserved: false,
    });
    for (const forbidden of ['status', 'payment_verified', 'total_amount', 'order_number', 'stock_reserved']) {
      expect(result, `${forbidden} must not survive parsing`).not.toHaveProperty(forbidden);
    }
  });

  it('requires the customer identity fields', () => {
    expect(errorFields(createOrderSchema, { idempotency_key: 'x', items: [] }).sort())
      .toEqual(['customer_email', 'customer_name', 'customer_phone']);
  });

  it('leaves items alone for cart-input.ts to validate', () => {
    // Anything is accepted here; parseCartLines owns the cart line rules.
    expect(parsed<any>(createOrderSchema, { ...valid, items: 'nonsense' }).items).toBe('nonsense');
  });

  it('coerces expected_total and refuses a nonsensical one', () => {
    expect(parsed<any>(createOrderSchema, { ...valid, expected_total: '1500' }).expected_total).toBe(1500);
    expect(errorFields(createOrderSchema, { ...valid, expected_total: -5 })).toEqual(['expected_total']);
    expect(errorFields(createOrderSchema, { ...valid, expected_total: 'abc' })).toEqual(['expected_total']);
  });

  it('accepts an order with no expected_total', () => {
    expect(parsed<any>(createOrderSchema, valid).expected_total).toBeUndefined();
  });
});

describe('checkoutQuoteSchema', () => {
  it('requires the checkout reference', () => {
    expect(errorFields(checkoutQuoteSchema, { items: [] })).toEqual(['idempotency_key']);
  });

  it('rejects a non-object body rather than throwing on body.items', () => {
    expect(errorFields(checkoutQuoteSchema, null).length).toBeGreaterThan(0);
  });
});
