/**
 * What survives a refresh mid-payment, and what a corrupt draft must not do.
 *
 * sessionStorage is writable by whoever owns the browser, so every field is
 * checked on the way back in — a draft that cannot be trusted has to degrade
 * to "start again", never to a payment screen showing NaN or an order number
 * that was never issued.
 */
import { describe, it, expect } from 'vitest';
import {
  parseCheckoutDraft,
  serializeCheckoutDraft,
  parseCheckoutStep,
  type CheckoutDraft,
} from './checkout-draft';

const draft = (overrides: Partial<CheckoutDraft> = {}): CheckoutDraft => ({
  orderNumber: 'UT12345678',
  orderTotal: 23_500,
  idempotencyKey: '3f1e6f2c-0b3a-4a1f-9c2d-8e5b7a4d1c90',
  formData: {
    firstName: 'Ada',
    lastName: 'Obi',
    email: 'ada@example.com',
    phone: '08012345678',
    address: '4 Marina Road',
    city: 'Lagos',
    note: 'Call on arrival',
    subscribeToNewsletter: true,
  },
  deliveryOption: 'delivery',
  selectedState: 'Lagos',
  selectedLga: 'Eti-Osa',
  selectedPlace: 'Lekki Phase 1',
  ...overrides,
});

describe('round trip', () => {
  it('restores a draft unchanged', () => {
    const original = draft();
    expect(parseCheckoutDraft(serializeCheckoutDraft(original))).toEqual(original);
  });

  it('keeps the idempotency key, which the order number is reserved against', () => {
    const restored = parseCheckoutDraft(serializeCheckoutDraft(draft()));
    expect(restored?.idempotencyKey).toBe(draft().idempotencyKey);
  });
});

describe('parseCheckoutDraft', () => {
  it('returns null for nothing stored', () => {
    expect(parseCheckoutDraft(null)).toBeNull();
    expect(parseCheckoutDraft('')).toBeNull();
  });

  it('returns null for unparseable or non-object JSON', () => {
    expect(parseCheckoutDraft('{oh no')).toBeNull();
    expect(parseCheckoutDraft('"a string"')).toBeNull();
    expect(parseCheckoutDraft('[1,2]')).toBeNull();
    expect(parseCheckoutDraft('null')).toBeNull();
  });

  it('discards a draft written by an older shape', () => {
    expect(parseCheckoutDraft(JSON.stringify({ ...draft(), version: 0 }))).toBeNull();
    expect(parseCheckoutDraft(JSON.stringify(draft()))).toBeNull();
  });

  it('requires an order number and an idempotency key', () => {
    const write = (overrides: object) =>
      parseCheckoutDraft(serializeCheckoutDraft({ ...draft(), ...overrides } as CheckoutDraft));

    expect(write({ orderNumber: '' })).toBeNull();
    expect(write({ orderNumber: '   ' })).toBeNull();
    expect(write({ idempotencyKey: '' })).toBeNull();
    expect(write({ orderNumber: 42 })).toBeNull();
  });

  it('rejects a total that is not a usable amount', () => {
    const write = (orderTotal: unknown) =>
      parseCheckoutDraft(serializeCheckoutDraft({ ...draft(), orderTotal } as CheckoutDraft));

    // The payment screen's whole job is telling somebody what to transfer.
    expect(write(0)).toBeNull();
    expect(write(-100)).toBeNull();
    expect(write('lots')).toBeNull();
    expect(write(Number.NaN)).toBeNull();
    expect(write(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('fills missing or wrongly-typed form fields with empty strings', () => {
    const restored = parseCheckoutDraft(
      JSON.stringify({ ...draft(), version: 1, formData: { firstName: 'Ada', phone: 12345 } })
    );

    expect(restored?.formData).toEqual({
      firstName: 'Ada',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      note: '',
      subscribeToNewsletter: false,
    });
  });

  it('treats an unrecognised delivery option as pickup', () => {
    // Pickup charges no delivery fee, so the mistake cannot inflate a total.
    const restored = parseCheckoutDraft(
      JSON.stringify({ ...draft(), version: 1, deliveryOption: 'teleport' })
    );
    expect(restored?.deliveryOption).toBe('pickup');
  });

  it('survives a missing formData object entirely', () => {
    const restored = parseCheckoutDraft(
      JSON.stringify({ ...draft(), version: 1, formData: undefined })
    );
    expect(restored?.formData.email).toBe('');
  });
});

describe('parseCheckoutStep', () => {
  it('accepts the three real steps', () => {
    expect(parseCheckoutStep('form')).toBe('form');
    expect(parseCheckoutStep('payment')).toBe('payment');
    expect(parseCheckoutStep('confirmation')).toBe('confirmation');
  });

  it('rejects anything else, including an absent parameter', () => {
    // No parameter is a fresh arrival at /checkout, which starts at step one.
    expect(parseCheckoutStep(null)).toBeNull();
    expect(parseCheckoutStep(undefined)).toBeNull();
    expect(parseCheckoutStep('')).toBeNull();
    expect(parseCheckoutStep('Payment')).toBeNull();
    expect(parseCheckoutStep('4')).toBeNull();
  });
});
