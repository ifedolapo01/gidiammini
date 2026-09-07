/**
 * Promised vs. actual, per zone. The case worth pinning is the one that makes
 * this report exist at all: a zone that is quietly late on most of its
 * orders, and the aggregate that has to surface it rather than average it away.
 */
import { describe, it, expect } from 'vitest';
import { deliveryPerformanceByZone } from './delivery-performance';

describe('deliveryPerformanceByZone', () => {
  const zones = new Map([
    ['z1', 'Lagos Mainland'],
    ['z2', 'Abuja'],
  ]);

  it('counts an order delivered after its promised end date as late', () => {
    const rows = deliveryPerformanceByZone(
      [{ id: 'o1', shipping_zone_id: 'z1', selected_state: 'Lagos', promised_delivery_end: '2026-09-10' }],
      new Map([['o1', '2026-09-13T00:00:00Z']]),
      zones
    );

    expect(rows[0]).toMatchObject({ label: 'Lagos Mainland', delivered: 1, late: 1, onTime: 0, lateRate: 1, avgDaysLate: 3 });
  });

  it('counts an order delivered on or before its promised end date as on time', () => {
    const rows = deliveryPerformanceByZone(
      [{ id: 'o1', shipping_zone_id: 'z1', selected_state: 'Lagos', promised_delivery_end: '2026-09-10' }],
      new Map([['o1', '2026-09-10T00:00:00Z']]),
      zones
    );

    expect(rows[0]).toMatchObject({ delivered: 1, late: 0, onTime: 1, lateRate: 0 });
  });

  it('ranks the zone with the worst late rate first', () => {
    const rows = deliveryPerformanceByZone(
      [
        { id: 'a1', shipping_zone_id: 'z1', selected_state: 'Lagos', promised_delivery_end: '2026-09-10' },
        { id: 'a2', shipping_zone_id: 'z1', selected_state: 'Lagos', promised_delivery_end: '2026-09-10' },
        { id: 'b1', shipping_zone_id: 'z2', selected_state: 'FCT', promised_delivery_end: '2026-09-10' },
      ],
      new Map([
        ['a1', '2026-09-15T00:00:00Z'], // z1: late
        ['a2', '2026-09-09T00:00:00Z'], // z1: on time
        ['b1', '2026-09-20T00:00:00Z'], // z2: late
      ]),
      zones
    );

    expect(rows[0].label).toBe('Abuja');
    expect(rows[0].lateRate).toBe(1);
    expect(rows[1].label).toBe('Lagos Mainland');
    expect(rows[1].lateRate).toBeCloseTo(0.5, 10);
  });

  it('skips an order with no recorded delivered timestamp', () => {
    const rows = deliveryPerformanceByZone(
      [{ id: 'o1', shipping_zone_id: 'z1', selected_state: 'Lagos', promised_delivery_end: '2026-09-10' }],
      new Map(),
      zones
    );

    expect(rows).toHaveLength(0);
  });

  it('skips a pickup order carrying no promised date', () => {
    const rows = deliveryPerformanceByZone(
      [{ id: 'o1', shipping_zone_id: null, selected_state: null, promised_delivery_end: null }],
      new Map([['o1', '2026-09-10T00:00:00Z']]),
      zones
    );

    expect(rows).toHaveLength(0);
  });

  it('falls back to the state when the zone has been deleted', () => {
    const rows = deliveryPerformanceByZone(
      [{ id: 'o1', shipping_zone_id: 'gone', selected_state: 'Ogun', promised_delivery_end: '2026-09-10' }],
      new Map([['o1', '2026-09-10T00:00:00Z']]),
      zones
    );

    expect(rows[0]).toMatchObject({ label: 'Ogun', delivered: 1 });
  });
});
