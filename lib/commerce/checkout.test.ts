/**
 * Tax and the fee/pickup lookups the checkout and priceOrder() both use.
 */
import { describe, it, expect } from 'vitest';
import { calculateTax, TAX_RATE, getDeliveryFee, isPickupAvailable, getDeliveryLabel } from './checkout';
import type { ShippingZone } from '@/types/shipping';

const zone = (over: Partial<ShippingZone>): ShippingZone => ({
  id: 'z', name: 'Zone', state: 'Lagos', lga: null, places: null,
  delivery_fee: 5000, pickup_available: false, pickup_address: null, contact_phone: null,
  delivery_label: 'Delivery', is_door_delivery: true,
  delivery_eta_min: 3, delivery_eta_max: 5, delivery_eta_unit: 'days',
  is_primary: false, is_active: true, sort_order: 0, ...over,
});

describe('calculateTax', () => {
  it('applies 7.5%', () => {
    expect(TAX_RATE).toBe(0.075);
    expect(calculateTax(20000)).toBe(1500);
  });

  it('always returns a whole number — total_amount is an integer column', () => {
    // 7.5% of 236,500 is 17,737.5, which would fail the insert unrounded.
    const tax = calculateTax(236500);
    expect(Number.isInteger(tax)).toBe(true);
    expect(tax).toBe(17738);
  });

  it('rounds rather than truncates', () => {
    expect(calculateTax(10000)).toBe(750);
    expect(calculateTax(13)).toBe(1); // 0.975 -> 1
  });

  it('is zero on an empty subtotal', () => {
    expect(calculateTax(0)).toBe(0);
  });
});

describe('getDeliveryFee', () => {
  it('returns the matched zone fee', () => {
    expect(getDeliveryFee([zone({ delivery_fee: 3000 })], 'Lagos')).toBe(3000);
  });

  it('returns 0 when nothing matches, rather than throwing', () => {
    expect(getDeliveryFee([zone({})], 'Kano')).toBe(0);
  });

  it('honours an exception fee', () => {
    const z = zone({
      delivery_fee: 5000,
      shipping_zone_exceptions: [{
        id: 'e', parent_zone_id: 'z', lga: 'Ikeja', places: null,
        delivery_fee: 1200, delivery_eta_min: null, delivery_eta_max: null,
        delivery_eta_unit: null, is_active: true,
      }],
    });
    expect(getDeliveryFee([z], 'Lagos', 'Ikeja')).toBe(1200);
  });
});

describe('isPickupAvailable', () => {
  it('is true only where the matched zone allows it', () => {
    expect(isPickupAvailable([zone({ pickup_available: true })], 'Lagos')).toBe(true);
    expect(isPickupAvailable([zone({ pickup_available: false })], 'Lagos')).toBe(false);
  });

  it('is false when no zone matches', () => {
    expect(isPickupAvailable([zone({ pickup_available: true })], 'Kano')).toBe(false);
  });
});

describe('getDeliveryLabel', () => {
  const pickupZone = [zone({ pickup_available: true })];

  it('labels pickup as pickup where pickup is available', () => {
    expect(getDeliveryLabel('pickup', pickupZone, 'Lagos')).toBe('Pickup');
  });

  it('falls back to delivery wording when pickup is not offered', () => {
    // Guards against promising a collection point the customer cannot use.
    expect(getDeliveryLabel('pickup', [zone({ pickup_available: false })], 'Lagos')).toBe('Delivery');
  });

  it('says "Drop-off Location" for a non-door-delivery zone', () => {
    const dropOff = [zone({ is_door_delivery: false })];
    expect(getDeliveryLabel('delivery', dropOff, 'Lagos', 'detailLabel')).toBe('Drop-off Location');
  });

  it('says "Delivery Address" for a door-delivery zone', () => {
    expect(getDeliveryLabel('delivery', [zone({ is_door_delivery: true })], 'Lagos', 'detailLabel')).toBe('Delivery Address');
  });

  it('supports the arrangement wordings', () => {
    expect(getDeliveryLabel('pickup', pickupZone, 'Lagos', 'arrangementTitle')).toBe('Pickup Arrangement');
    expect(getDeliveryLabel('delivery', pickupZone, 'Lagos', 'arrangementLower')).toBe('Delivery arrangement');
  });
});
