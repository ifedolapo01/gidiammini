/**
 * The whole point of this file: a cutoff time and a set of working days turn
 * "2-4 days" into a real calendar date, and getting the boundary wrong here
 * means promising a customer a date the zone was never going to hit.
 */
import { describe, it, expect } from 'vitest';
import { computeDispatchDate, computeDeliveryWindow, formatDeliveryWindow, minutesUntilCutoffToday } from './delivery-promise';
import type { ShippingZone } from '@/types/shipping';

type ScheduleEtaZone = Pick<
  ShippingZone,
  'working_days' | 'order_cutoff_time' | 'delivery_eta_min' | 'delivery_eta_max' | 'delivery_eta_unit'
>;

const zone = (over: Partial<ScheduleEtaZone> = {}): ScheduleEtaZone => ({
  working_days: [1, 2, 3, 4, 5, 6],
  order_cutoff_time: null,
  delivery_eta_min: 2,
  delivery_eta_max: 4,
  delivery_eta_unit: 'days',
  ...over,
});

// Monday 2026-09-07, 10:00 UTC.
const monday10am = new Date('2026-09-07T10:00:00Z');

describe('computeDispatchDate', () => {
  it('dispatches today when there is no cutoff and today is a working day', () => {
    expect(computeDispatchDate(monday10am, zone()).toISOString().slice(0, 10)).toBe('2026-09-07');
  });

  it('dispatches today when placed before the cutoff', () => {
    const z = zone({ order_cutoff_time: '14:00:00' });
    expect(computeDispatchDate(monday10am, z).toISOString().slice(0, 10)).toBe('2026-09-07');
  });

  it('pushes to the next working day once the cutoff has passed', () => {
    const z = zone({ order_cutoff_time: '09:00:00' });
    expect(computeDispatchDate(monday10am, z).toISOString().slice(0, 10)).toBe('2026-09-08');
  });

  it('skips a day not in working_days, e.g. Sunday', () => {
    // Saturday 2026-09-05, not a working day for a Mon-Fri zone.
    const saturday = new Date('2026-09-05T10:00:00Z');
    const z = zone({ working_days: [1, 2, 3, 4, 5] });
    expect(computeDispatchDate(saturday, z).toISOString().slice(0, 10)).toBe('2026-09-07');
  });
});

describe('computeDeliveryWindow', () => {
  it('walks forward the given number of working days from dispatch', () => {
    // Dispatch Monday 09-07; +2 working days = Wed 09-09, +4 = Fri 09-11.
    const { start, end } = computeDeliveryWindow(monday10am, zone());
    expect(start.toISOString().slice(0, 10)).toBe('2026-09-09');
    expect(end.toISOString().slice(0, 10)).toBe('2026-09-11');
  });

  it('skips non-working days while walking transit days', () => {
    // Friday dispatch, Mon-Fri zone, +2 working days lands on the following Tuesday.
    const friday = new Date('2026-09-11T08:00:00Z');
    const z = zone({ working_days: [1, 2, 3, 4, 5], delivery_eta_min: 2, delivery_eta_max: 2 });
    const { start, end } = computeDeliveryWindow(friday, z);
    expect(start.toISOString().slice(0, 10)).toBe('2026-09-15');
    expect(end.toISOString().slice(0, 10)).toBe('2026-09-15');
  });
});

describe('formatDeliveryWindow', () => {
  it('formats a single date once start equals end', () => {
    const d = new Date('2026-09-09T00:00:00Z');
    expect(formatDeliveryWindow(d, d)).toBe('Wed 9 Sept');
  });

  it('formats a range within the same month with one trailing month name', () => {
    const start = new Date('2026-09-09T00:00:00Z');
    const end = new Date('2026-09-11T00:00:00Z');
    expect(formatDeliveryWindow(start, end)).toBe('Wed 9 – Fri 11 Sept');
  });

  it('formats a range crossing a month boundary with both month names', () => {
    const start = new Date('2026-09-29T00:00:00Z');
    const end = new Date('2026-10-01T00:00:00Z');
    expect(formatDeliveryWindow(start, end)).toBe('Tue 29 Sept – Thu 1 Oct');
  });
});

describe('minutesUntilCutoffToday', () => {
  it('is null when the zone has no cutoff', () => {
    expect(minutesUntilCutoffToday(monday10am, zone())).toBeNull();
  });

  it('counts the minutes remaining before an upcoming cutoff', () => {
    const z = zone({ order_cutoff_time: '14:00:00' });
    expect(minutesUntilCutoffToday(monday10am, z)).toBe(240);
  });

  it('is null once the cutoff has already passed', () => {
    const z = zone({ order_cutoff_time: '09:00:00' });
    expect(minutesUntilCutoffToday(monday10am, z)).toBeNull();
  });
});
