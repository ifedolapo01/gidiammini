/**
 * The rule that decides whether a confirmed delivery order has been forgotten.
 *
 * It drives the admin's overdue-shipments alert, so both failure directions
 * cost something real: too eager and the ticker cries wolf until nobody reads
 * it, too slow and a customer waits while nothing on the dashboard says so.
 *
 * The guards are each their own case below, because each is a different reason
 * an order is legitimately *not* overdue, and getting any of them backwards is
 * invisible until somebody complains.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getShippingOverdueInfo } from './shipping-overdue';
import type { ShippingZone } from '@/types/shipping';

const zone = (over: Partial<ShippingZone> = {}): ShippingZone => ({
  id: 'z', name: 'Lagos Mainland', state: 'Lagos', lga: null, places: null,
  delivery_fee: 5000, pickup_available: false, pickup_address: null, contact_phone: null,
  delivery_label: 'Delivery', is_door_delivery: true,
  delivery_eta_min: 2, delivery_eta_max: 3, delivery_eta_unit: 'days',
  is_primary: false, is_active: true, sort_order: 0, ...over,
});

const NOW = new Date('2026-09-10T12:00:00.000Z');

/** An order confirmed `hours` before NOW. */
const order = (hours: number, over: Record<string, unknown> = {}) => ({
  status: 'confirmed',
  delivery_option: 'delivery' as const,
  selected_state: 'Lagos',
  selected_lga: null,
  selected_place: null,
  updated_at: new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString(),
  ...over,
});

/** The zone above allows 3 days, so the window is 72 hours. */
const WINDOW_HOURS = 72;

function at(now: Date) {
  vi.useFakeTimers();
  vi.setSystemTime(now);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('getShippingOverdueInfo', () => {
  it('reports how far past the window a late order is', () => {
    at(NOW);
    expect(getShippingOverdueInfo(order(WINDOW_HOURS + 5), [zone()])).toEqual({ hoursOverdue: 5 });
  });

  it('is silent inside the window', () => {
    at(NOW);
    expect(getShippingOverdueInfo(order(WINDOW_HOURS - 1), [zone()])).toBeNull();
  });

  it('treats the boundary itself as still on time', () => {
    at(NOW);
    // The comparison is `<=`. An order flagged the very second its window
    // closes would alert on every order that arrives exactly on schedule.
    expect(getShippingOverdueInfo(order(WINDOW_HOURS), [zone()])).toBeNull();
  });

  it('ignores a pickup order', () => {
    at(NOW);
    // Nobody is shipping it, so there is no shipping to be late with.
    expect(
      getShippingOverdueInfo(order(WINDOW_HOURS + 48, { delivery_option: 'pickup' }), [zone()]),
    ).toBeNull();
  });

  it('ignores an order that is not confirmed', () => {
    at(NOW);
    for (const status of ['pending', 'shipped', 'delivered', 'cancelled']) {
      expect(getShippingOverdueInfo(order(WINDOW_HOURS + 48, { status }), [zone()])).toBeNull();
    }
  });

  it('is silent when no zone matches the address', () => {
    at(NOW);
    // No zone means no ETA, and an overdue figure would have to be invented.
    expect(
      getShippingOverdueInfo(order(WINDOW_HOURS + 48, { selected_state: 'Kano' }), [zone()]),
    ).toBeNull();
  });

  it("reads the window from the matched zone, in that zone's own unit", () => {
    at(NOW);
    // Two weeks = 336 hours. A zone quoted in weeks must not be compared
    // against a count of days — that unit slip would flag every interstate
    // order the moment it was confirmed.
    const slow = zone({ delivery_eta_max: 2, delivery_eta_unit: 'weeks' });
    expect(getShippingOverdueInfo(order(300), [slow])).toBeNull();
    expect(getShippingOverdueInfo(order(340), [slow])).toEqual({ hoursOverdue: 4 });
  });

  it('rounds the reported figure to whole hours', () => {
    at(NOW);
    expect(getShippingOverdueInfo(order(WINDOW_HOURS + 2.4), [zone()])).toEqual({ hoursOverdue: 2 });
    expect(getShippingOverdueInfo(order(WINDOW_HOURS + 2.6), [zone()])).toEqual({ hoursOverdue: 3 });
  });
});
