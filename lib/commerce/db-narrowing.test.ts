/**
 * Narrowing values read out of the database into the app's union types.
 *
 * These exist because Postgres enforces valid values with CHECK constraints,
 * which a type generator can only see as `text`. The important property is that
 * they *validate* rather than blind-cast: an unrecognised value must be loud,
 * not silently accepted and then fall through every switch statement.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  asOrderStatus, asDeliveryOption, narrowOrderFields,
  asNotifiedPhases, asDiscount, asEtaUnit, narrowShippingZones,
} from './db-narrowing';

afterEach(() => vi.restoreAllMocks());

/** Silences the expected console.error while still asserting it happened. */
const captureError = () => vi.spyOn(console, 'error').mockImplementation(() => {});

describe('asOrderStatus', () => {
  it('passes through every canonical status', () => {
    for (const s of ['pending', 'confirmed', 'rescheduled', 'shipped', 'ready_for_pickup', 'picked_up', 'delivered', 'cancelled']) {
      expect(asOrderStatus(s)).toBe(s);
    }
  });

  it('falls back to pending and logs loudly for an unknown status', () => {
    const spy = captureError();
    expect(asOrderStatus('refunded')).toBe('pending');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toMatch(/ORDER_STATUSES/);
  });

  it('handles null and undefined', () => {
    captureError();
    expect(asOrderStatus(null)).toBe('pending');
    expect(asOrderStatus(undefined)).toBe('pending');
  });

  it('does not accept a near-miss like different casing', () => {
    captureError();
    expect(asOrderStatus('Pending')).toBe('pending');
    expect(asOrderStatus('CONFIRMED')).toBe('pending');
  });
});

describe('asDeliveryOption', () => {
  it('passes through the two valid options', () => {
    expect(asDeliveryOption('pickup')).toBe('pickup');
    expect(asDeliveryOption('delivery')).toBe('delivery');
  });

  it('defaults to delivery, which never promises an unusable pickup point', () => {
    captureError();
    expect(asDeliveryOption('collect')).toBe('delivery');
    expect(asDeliveryOption(null)).toBe('delivery');
  });

  it('does not log for a null value — that is absence, not corruption', () => {
    const spy = captureError();
    asDeliveryOption(null);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('narrowOrderFields', () => {
  it('narrows both fields and preserves the rest of the row', () => {
    const row = { id: 'o1', status: 'shipped', delivery_option: 'pickup', customer_name: 'Ada' };
    expect(narrowOrderFields(row)).toEqual({
      id: 'o1', status: 'shipped', delivery_option: 'pickup', customer_name: 'Ada',
    });
  });

  it('repairs a corrupt row instead of passing it on', () => {
    captureError();
    const narrowed = narrowOrderFields({ id: 'o1', status: 'weird', delivery_option: 'weird' });
    expect(narrowed.status).toBe('pending');
    expect(narrowed.delivery_option).toBe('delivery');
  });
});

describe('asNotifiedPhases', () => {
  it('keeps an array of strings', () => {
    expect(asNotifiedPhases(['DAY_1', 'LAST_DAY'])).toEqual(['DAY_1', 'LAST_DAY']);
  });

  it('treats anything that is not an array as "nothing sent yet"', () => {
    // jsonb types as Json, so this could legitimately be any shape.
    for (const bad of [null, undefined, 'DAY_1', 42, { DAY_1: true }]) {
      expect(asNotifiedPhases(bad)).toEqual([]);
    }
  });

  it('drops non-string entries rather than letting them through', () => {
    expect(asNotifiedPhases(['DAY_1', 5, null, 'LAST_DAY'])).toEqual(['DAY_1', 'LAST_DAY']);
  });
});

describe('asEtaUnit', () => {
  it('passes through the three valid units', () => {
    expect(asEtaUnit('days')).toBe('days');
    expect(asEtaUnit('weeks')).toBe('weeks');
    expect(asEtaUnit('months')).toBe('months');
  });

  it('defaults to days, which under-promises rather than over-promises', () => {
    captureError();
    expect(asEtaUnit('fortnights')).toBe('days');
    expect(asEtaUnit(null)).toBe('days');
  });
});

describe('narrowShippingZones', () => {
  const raw = (over: Record<string, unknown> = {}) => ({
    id: 'z', name: 'Lagos', state: 'Lagos', delivery_eta_unit: 'weeks',
    shipping_zone_exceptions: [], ...over,
  });

  it('narrows the zone unit', () => {
    expect(narrowShippingZones([raw()])[0].delivery_eta_unit).toBe('weeks');
  });

  it('narrows an exception unit too', () => {
    const zones = narrowShippingZones([raw({
      shipping_zone_exceptions: [{ id: 'e', delivery_eta_unit: 'months' }],
    })]);
    expect(zones[0].shipping_zone_exceptions?.[0].delivery_eta_unit).toBe('months');
  });

  it('keeps a null exception unit as null — that means "inherit the parent"', () => {
    const zones = narrowShippingZones([raw({
      shipping_zone_exceptions: [{ id: 'e', delivery_eta_unit: null }],
    })]);
    expect(zones[0].shipping_zone_exceptions?.[0].delivery_eta_unit).toBeNull();
  });

  it('handles a missing exceptions array', () => {
    const zones = narrowShippingZones([raw({ shipping_zone_exceptions: undefined })]);
    expect(zones[0].shipping_zone_exceptions).toEqual([]);
  });

  it('handles null and undefined input', () => {
    expect(narrowShippingZones(null)).toEqual([]);
    expect(narrowShippingZones(undefined)).toEqual([]);
  });
});

describe('asDiscount', () => {
  const row = {
    id: 'd1', name: 'Sale', type: 'PERCENTAGE', value: 10, scope: 'SITEWIDE',
    target_id: null, is_active: true, start_date: null, end_date: null, created_at: null,
  };

  it('maps a row onto the Discount shape', () => {
    expect(asDiscount(row)).toEqual({
      id: 'd1', name: 'Sale', type: 'PERCENTAGE', value: 10, scope: 'SITEWIDE',
      target_id: null, is_active: true, start_date: null, end_date: null, created_at: undefined,
    });
  });

  it('treats a null is_active as inactive — the safe reading', () => {
    expect(asDiscount({ ...row, is_active: null }).is_active).toBe(false);
  });

  it('turns a null created_at into undefined, matching the optional field', () => {
    expect(asDiscount({ ...row, created_at: null }).created_at).toBeUndefined();
  });

  it('carries VARIANT scope and its target through', () => {
    const d = asDiscount({ ...row, scope: 'VARIANT', target_id: 'p1:M:red' });
    expect(d.scope).toBe('VARIANT');
    expect(d.target_id).toBe('p1:M:red');
  });
});
