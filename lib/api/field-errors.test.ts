/**
 * Reading server field errors on the client.
 *
 * Both functions have to be safe against a response that carries no field
 * detail at all — a 500, a rate limit, a network error shaped into a fake body.
 * A form that throws while trying to display an error is worse than the error.
 */
import { describe, it, expect } from 'vitest';
import {
  readFieldErrors,
  mapFieldErrors,
  CHECKOUT_FIELD_MAP,
  CHANGE_REQUEST_FIELD_MAP,
} from './field-errors';
import { createOrderSchema, orderChangeRequestSchema } from './schemas/public-orders';

describe('readFieldErrors', () => {
  it('reads a well-formed fieldErrors object', () => {
    expect(readFieldErrors({ success: false, error: 'x', fieldErrors: { email: 'Bad email.' } }))
      .toEqual({ email: 'Bad email.' });
  });

  it('returns an empty object when the server sent no field detail', () => {
    expect(readFieldErrors({ success: false, error: 'Rate limited' })).toEqual({});
    expect(readFieldErrors({})).toEqual({});
  });

  it('survives every shape a failed fetch can produce', () => {
    for (const body of [null, undefined, 'a string', 42, [], true]) {
      expect(readFieldErrors(body)).toEqual({});
    }
  });

  it('ignores an array, which is not a field map', () => {
    expect(readFieldErrors({ fieldErrors: ['Bad email.'] })).toEqual({});
  });

  it('drops entries that are not usable messages', () => {
    expect(readFieldErrors({
      fieldErrors: { email: 'Bad email.', phone: 42, name: null, note: '', city: {} },
    })).toEqual({ email: 'Bad email.' });
  });

  it('keeps dotted paths intact for nested fields', () => {
    expect(readFieldErrors({ fieldErrors: { 'details.city': 'City is required.' } }))
      .toEqual({ 'details.city': 'City is required.' });
  });
});

describe('mapFieldErrors', () => {
  const mapping = {
    customer_name: 'firstName',
    customer_email: 'email',
    customer_phone: 'phone',
  };

  it('renames server fields to the inputs the customer can see', () => {
    expect(mapFieldErrors({ customer_email: 'Bad email.' }, mapping)).toEqual({ email: 'Bad email.' });
  });

  it('keeps unmapped fields under their own name rather than dropping them', () => {
    // A new server field should still surface somewhere.
    expect(mapFieldErrors({ receipt_path: 'Too long.' }, mapping)).toEqual({ receipt_path: 'Too long.' });
  });

  it('keeps the first message when two server fields map onto one input', () => {
    const result = mapFieldErrors(
      { customer_name: 'Name is required.', customer_email: 'Email is required.' },
      { customer_name: 'firstName', customer_email: 'firstName' }
    );
    expect(result).toEqual({ firstName: 'Name is required.' });
  });

  it('passes an empty set through unchanged', () => {
    expect(mapFieldErrors({}, mapping)).toEqual({});
  });

  it('is a no-op with an empty mapping', () => {
    expect(mapFieldErrors({ a: 'A.' }, {})).toEqual({ a: 'A.' });
  });
});

/**
 * These pin the map keys to the paths the schemas actually produce. A typo in a
 * key is otherwise invisible: the highlight simply never appears, and nothing
 * fails. So rather than hardcoding the expected paths, each test asks the real
 * schema what it emits and checks the map covers it.
 */
describe('the field maps match what the schemas emit', () => {
  /** Every field path a schema complains about for the given input. */
  const pathsFor = (schema: { safeParse: (v: unknown) => any }, input: unknown): string[] => {
    const result = schema.safeParse(input);
    expect(result.success).toBe(false);
    return result.error.issues.map((i: any) => i.path.join('.'));
  };

  it('covers every checkout field a customer can correct', () => {
    const paths = pathsFor(createOrderSchema, {
      idempotency_key: 'k',
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      delivery_address: 'a'.repeat(600),
      city: 'c'.repeat(200),
      note: 'n'.repeat(2000),
    });

    for (const path of paths) {
      expect(CHECKOUT_FIELD_MAP, `${path} has no mapping, so it would never be highlighted`)
        .toHaveProperty(path);
    }
  });

  it('covers the nested reschedule detail', () => {
    const paths = pathsFor(orderChangeRequestSchema, {
      orderNumber: 'UT12345678', contact: 'a@b.co', requestType: 'reschedule', details: {},
    });
    expect(paths).toContain('details.preferredDate');
    expect(CHANGE_REQUEST_FIELD_MAP['details.preferredDate']).toBe('preferredDate');
  });

  it('covers the nested delivery-switch details', () => {
    const paths = pathsFor(orderChangeRequestSchema, {
      orderNumber: 'UT12345678',
      contact: 'a@b.co',
      requestType: 'delivery_method_change',
      details: { newDeliveryOption: 'delivery' },
    });
    expect(paths.sort()).toEqual(['details.city', 'details.deliveryAddress']);
    for (const path of paths) {
      expect(CHANGE_REQUEST_FIELD_MAP).toHaveProperty(path);
    }
  });

  it('maps customerNote straight through, since it is not nested', () => {
    const paths = pathsFor(orderChangeRequestSchema, {
      orderNumber: 'UT12345678', contact: 'a@b.co', requestType: 'cancel',
      customerNote: 'x'.repeat(2000),
    });
    expect(paths).toEqual(['customerNote']);
    // Unmapped on purpose: the form's input is already called customerNote.
    expect(mapFieldErrors({ customerNote: 'Too long.' }, CHANGE_REQUEST_FIELD_MAP))
      .toEqual({ customerNote: 'Too long.' });
  });

  it('leaves fields with no input under their own key, for the summary', () => {
    // The form derives newDeliveryOption, so there is no input to highlight.
    // It must not be silently dropped either.
    const mapped = mapFieldErrors(
      { 'details.newDeliveryOption': 'Choose either pickup or delivery.' },
      CHANGE_REQUEST_FIELD_MAP
    );
    expect(mapped).toEqual({ newDeliveryOption: 'Choose either pickup or delivery.' });
  });
});
