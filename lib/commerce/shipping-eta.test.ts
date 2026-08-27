/**
 * ETA formatting and the overdue-shipment window. etaMaxHours is what decides
 * whether an order shows as overdue in the admin, so a unit conversion mistake
 * here either floods the alerts ticker or hides late orders entirely.
 */
import { describe, it, expect } from 'vitest';
import { formatEtaRange, formatZoneEta, aggregateEtaRange, etaMaxHours } from './shipping-eta';
import type { ShippingZone } from '@/types/shipping';

const zone = (over: Partial<ShippingZone>): ShippingZone => ({
  id: 'z', name: 'Zone', state: 'Lagos', lga: null, places: null,
  delivery_fee: 5000, pickup_available: false, pickup_address: null, contact_phone: null,
  delivery_label: 'Delivery', is_door_delivery: true,
  delivery_eta_min: 3, delivery_eta_max: 5, delivery_eta_unit: 'days',
  is_primary: false, is_active: true, sort_order: 0, ...over,
});

describe('formatEtaRange', () => {
  it('shows a range', () => {
    expect(formatEtaRange(3, 5, 'days')).toBe('3-5 days');
  });

  it('collapses an equal range to a single value', () => {
    expect(formatEtaRange(2, 2, 'weeks')).toBe('2 weeks');
  });

  it('singularises a value of one', () => {
    expect(formatEtaRange(1, 1, 'days')).toBe('1 day');
    expect(formatEtaRange(1, 1, 'weeks')).toBe('1 week');
    expect(formatEtaRange(1, 1, 'months')).toBe('1 month');
  });

  it('pluralises based on the upper bound of a range', () => {
    expect(formatEtaRange(1, 2, 'days')).toBe('1-2 days');
  });
});

describe('formatZoneEta', () => {
  it('reads the zone fields', () => {
    expect(formatZoneEta(zone({ delivery_eta_min: 1, delivery_eta_max: 2 }))).toBe('1-2 days');
  });
});

describe('etaMaxHours', () => {
  it('converts days', () => {
    expect(etaMaxHours(zone({ delivery_eta_max: 5, delivery_eta_unit: 'days' }))).toBe(120);
  });

  it('converts weeks', () => {
    expect(etaMaxHours(zone({ delivery_eta_max: 2, delivery_eta_unit: 'weeks' }))).toBe(336);
  });

  it('converts months as 30 days', () => {
    expect(etaMaxHours(zone({ delivery_eta_max: 1, delivery_eta_unit: 'months' }))).toBe(720);
  });
});

describe('aggregateEtaRange', () => {
  it('spans the widest window across zones sharing a unit', () => {
    const zones = [
      zone({ delivery_eta_min: 1, delivery_eta_max: 2 }),
      zone({ delivery_eta_min: 3, delivery_eta_max: 7 }),
    ];
    expect(aggregateEtaRange(zones)).toBe('1-7 days');
  });

  it('normalises to days when units are mixed', () => {
    const zones = [
      zone({ delivery_eta_min: 1, delivery_eta_max: 2, delivery_eta_unit: 'days' }),
      zone({ delivery_eta_min: 1, delivery_eta_max: 2, delivery_eta_unit: 'weeks' }),
    ];
    expect(aggregateEtaRange(zones)).toBe('1-14 days');
  });

  it('ignores inactive zones', () => {
    const zones = [
      zone({ delivery_eta_min: 3, delivery_eta_max: 5 }),
      zone({ delivery_eta_min: 30, delivery_eta_max: 60, is_active: false }),
    ];
    expect(aggregateEtaRange(zones)).toBe('3-5 days');
  });

  it('returns null when there is nothing active to aggregate', () => {
    expect(aggregateEtaRange([])).toBeNull();
    expect(aggregateEtaRange([zone({ is_active: false })])).toBeNull();
  });
});
