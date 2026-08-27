/**
 * Zone resolution decides the delivery fee, the ETA, and whether pickup is even
 * offered. priceOrder() calls it server-side, so getting the precedence wrong
 * means charging the wrong shipping — the exact bug class the price-authority
 * work was meant to close.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveEffectiveZone,
  getAvailableStates,
  getDistrictOptions,
  formatZoneLocation,
} from './shipping-match';
import type { ShippingZone, ShippingZoneException } from '@/types/shipping';

const zone = (over: Partial<ShippingZone>): ShippingZone => ({
  id: 'z', name: 'Zone', state: 'Lagos', lga: null, places: null,
  delivery_fee: 5000, pickup_available: false, pickup_address: null, contact_phone: null,
  delivery_label: 'Delivery', is_door_delivery: true,
  delivery_eta_min: 3, delivery_eta_max: 5, delivery_eta_unit: 'days',
  is_primary: false, is_active: true, sort_order: 0, ...over,
});

const exception = (over: Partial<ShippingZoneException>): ShippingZoneException => ({
  id: 'e', parent_zone_id: 'z', lga: null, places: null,
  delivery_fee: null, delivery_eta_min: null, delivery_eta_max: null,
  delivery_eta_unit: null, is_active: true, ...over,
});

describe('resolveEffectiveZone — precedence', () => {
  const stateWide = zone({ id: 'state', delivery_fee: 5000 });
  const lgaWide = zone({ id: 'lga', lga: 'Ikeja', delivery_fee: 3000 });
  const district = zone({ id: 'district', lga: 'Ikeja', places: 'Allen, Opebi', delivery_fee: 1500 });
  const all = [stateWide, lgaWide, district];

  it('prefers a district match over LGA and state', () => {
    expect(resolveEffectiveZone(all, 'Lagos', 'Ikeja', 'Allen')?.id).toBe('district');
  });

  it('falls back to the LGA zone when the district does not match', () => {
    expect(resolveEffectiveZone(all, 'Lagos', 'Ikeja', 'Nowhere')?.id).toBe('lga');
  });

  it('falls back to the LGA zone when no district is given', () => {
    expect(resolveEffectiveZone(all, 'Lagos', 'Ikeja')?.id).toBe('lga');
  });

  it('falls back to the state-wide zone for an unknown LGA', () => {
    expect(resolveEffectiveZone(all, 'Lagos', 'Badagry')?.id).toBe('state');
  });

  it('uses the state-wide zone when only a state is given', () => {
    expect(resolveEffectiveZone(all, 'Lagos')?.id).toBe('state');
  });

  it('returns undefined for a state with no zones', () => {
    expect(resolveEffectiveZone(all, 'Kano')).toBeUndefined();
  });

  it('ignores inactive zones', () => {
    expect(resolveEffectiveZone([zone({ id: 'off', is_active: false })], 'Lagos')).toBeUndefined();
  });

  it('matches places case-insensitively and ignores surrounding whitespace', () => {
    expect(resolveEffectiveZone(all, 'Lagos', 'Ikeja', '  allen  ')?.id).toBe('district');
  });

  it('splits places on newlines as well as commas', () => {
    const nl = [zone({ id: 'nl', lga: 'Ikeja', places: 'Allen\nOpebi' })];
    expect(resolveEffectiveZone(nl, 'Lagos', 'Ikeja', 'Opebi')?.id).toBe('nl');
  });
});

describe('resolveEffectiveZone — exceptions override fee and ETA only', () => {
  const parent = zone({
    id: 'p', delivery_fee: 5000, pickup_available: true, pickup_address: 'Head office',
    delivery_label: 'Door-to-door', is_door_delivery: true,
    delivery_eta_min: 3, delivery_eta_max: 5, delivery_eta_unit: 'days', lga: null,
    shipping_zone_exceptions: [
      exception({ lga: 'Ikeja', delivery_fee: 1200, delivery_eta_min: 1, delivery_eta_max: 2 }),
    ],
  });

  it('applies the exception fee and ETA', () => {
    const r = resolveEffectiveZone([parent], 'Lagos', 'Ikeja');
    expect(r?.delivery_fee).toBe(1200);
    expect(r?.delivery_eta_min).toBe(1);
    expect(r?.delivery_eta_max).toBe(2);
  });

  it('never lets an exception change pickup, address, label or door-delivery', () => {
    const r = resolveEffectiveZone([parent], 'Lagos', 'Ikeja');
    expect(r?.pickup_available).toBe(true);
    expect(r?.pickup_address).toBe('Head office');
    expect(r?.delivery_label).toBe('Door-to-door');
    expect(r?.is_door_delivery).toBe(true);
    expect(r?.id).toBe('p');
  });

  it('inherits the parent value for any field the exception leaves null', () => {
    const feeOnly = zone({
      id: 'p2', delivery_fee: 5000, delivery_eta_unit: 'weeks',
      shipping_zone_exceptions: [exception({ lga: 'Ikeja', delivery_fee: 900 })],
    });
    const r = resolveEffectiveZone([feeOnly], 'Lagos', 'Ikeja');
    expect(r?.delivery_fee).toBe(900);
    expect(r?.delivery_eta_min).toBe(3);
    expect(r?.delivery_eta_unit).toBe('weeks');
  });

  it('ignores an inactive exception', () => {
    const off = zone({
      id: 'p3', delivery_fee: 5000,
      shipping_zone_exceptions: [exception({ lga: 'Ikeja', delivery_fee: 100, is_active: false })],
    });
    expect(resolveEffectiveZone([off], 'Lagos', 'Ikeja')?.delivery_fee).toBe(5000);
  });

  it('prefers a place-scoped exception over an LGA-wide one', () => {
    const both = zone({
      id: 'p4', delivery_fee: 5000,
      shipping_zone_exceptions: [
        exception({ id: 'lgaWide', lga: 'Ikeja', delivery_fee: 3000 }),
        exception({ id: 'placeScoped', lga: 'Ikeja', places: 'Allen', delivery_fee: 800 }),
      ],
    });
    expect(resolveEffectiveZone([both], 'Lagos', 'Ikeja', 'Allen')?.delivery_fee).toBe(800);
    expect(resolveEffectiveZone([both], 'Lagos', 'Ikeja', 'Opebi')?.delivery_fee).toBe(3000);
  });

  it('does not apply any exception when no LGA is given', () => {
    expect(resolveEffectiveZone([parent], 'Lagos')?.delivery_fee).toBe(5000);
  });
});

describe('getAvailableStates', () => {
  it('lists distinct active states, sorted', () => {
    const zones = [zone({ state: 'Oyo' }), zone({ state: 'Lagos' }), zone({ state: 'Lagos', lga: 'Ikeja' })];
    expect(getAvailableStates(zones)).toEqual(['Lagos', 'Oyo']);
  });

  it('omits states that only have inactive zones', () => {
    expect(getAvailableStates([zone({ state: 'Kano', is_active: false })])).toEqual([]);
  });
});

describe('getDistrictOptions', () => {
  it('collects place names from zones and exceptions for that state and LGA', () => {
    const zones = [
      zone({ lga: 'Ikeja', places: 'Allen, Opebi' }),
      zone({ id: 'z2', lga: null, shipping_zone_exceptions: [exception({ lga: 'Ikeja', places: 'Oregun' })] }),
    ];
    expect(getDistrictOptions(zones, 'Lagos', 'Ikeja')).toEqual(['Allen', 'Opebi', 'Oregun']);
  });

  it('returns nothing when no LGA is given', () => {
    expect(getDistrictOptions([zone({ lga: 'Ikeja', places: 'Allen' })], 'Lagos', '')).toEqual([]);
  });

  it('returns nothing when nothing narrower than the LGA is configured', () => {
    expect(getDistrictOptions([zone({ lga: 'Ikeja' })], 'Lagos', 'Ikeja')).toEqual([]);
  });
});

describe('formatZoneLocation', () => {
  it('shows just the state for a state-wide zone', () => {
    expect(formatZoneLocation(zone({}))).toBe('Lagos');
  });

  it('shows state and LGA', () => {
    expect(formatZoneLocation(zone({ lga: 'Ikeja' }))).toBe('Lagos › Ikeja');
  });

  it('shows state, LGA and places', () => {
    expect(formatZoneLocation(zone({ lga: 'Ikeja', places: 'Allen, Opebi' }))).toBe('Lagos › Ikeja › Allen, Opebi');
  });
});
