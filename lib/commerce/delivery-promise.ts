/** COMMERCE layer — turns a zone's cutoff time, working days, and (min, max,
 * unit) ETA into a real calendar date range, instead of the relative "2-4
 * days" lib/commerce/shipping-eta.ts formats. Isomorphic (no server-only, no
 * Supabase import) so both the checkout's client components and admin/report
 * code can call it directly.
 *
 * All day/time math is UTC. This store treats a WAT day as a UTC day
 * everywhere else a day boundary matters (lib/commerce/dashboard-analytics.ts,
 * app/admin/orders/components/DateRangeNotice.tsx) — this is that same
 * one-hour-off approximation, not a new one.
 */
import type { ShippingZone } from '@/types/shipping';
import { UNIT_TO_DAYS } from './shipping-eta';

const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6];

type ScheduleZone = Pick<ShippingZone, 'working_days' | 'order_cutoff_time'>;
type EtaZone = Pick<ShippingZone, 'delivery_eta_min' | 'delivery_eta_max' | 'delivery_eta_unit'>;

export interface DeliveryWindow {
  start: Date;
  end: Date;
}

function startOfUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function isWorkingDay(date: Date, workingDays: number[]): boolean {
  return workingDays.includes(isoWeekday(date));
}

/** The next date strictly after `date` that falls on one of `workingDays`. */
function nextWorkingDay(date: Date, workingDays: number[]): Date {
  const next = new Date(date);
  do {
    next.setUTCDate(next.getUTCDate() + 1);
  } while (!isWorkingDay(next, workingDays));
  return next;
}

function utcTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

/** The day an order placed at `now` actually leaves this zone: today, if today
 * is a working day and (there's no cutoff, or `now` is still before it) —
 * otherwise the next working day. */
export function computeDispatchDate(now: Date, zone: ScheduleZone): Date {
  const workingDays = zone.working_days?.length ? zone.working_days : DEFAULT_WORKING_DAYS;
  const today = startOfUtcDate(now);

  const beforeCutoff = zone.order_cutoff_time == null || utcTimeString(now) <= zone.order_cutoff_time;
  if (isWorkingDay(today, workingDays) && beforeCutoff) return today;

  return nextWorkingDay(today, workingDays);
}

/** The dispatch date plus `days` working days of transit, skipping the zone's
 * non-working days along the way. */
function addWorkingDays(dispatch: Date, days: number, workingDays: number[]): Date {
  let result = dispatch;
  for (let i = 0; i < days; i++) {
    result = nextWorkingDay(result, workingDays);
  }
  return result;
}

/** The calendar dates this order should arrive between, computed from `now`. */
export function computeDeliveryWindow(now: Date, zone: ScheduleZone & EtaZone): DeliveryWindow {
  const workingDays = zone.working_days?.length ? zone.working_days : DEFAULT_WORKING_DAYS;
  const dispatch = computeDispatchDate(now, zone);
  const unitDays = UNIT_TO_DAYS[zone.delivery_eta_unit];

  const minDays = Math.max(1, Math.round(zone.delivery_eta_min * unitDays));
  const maxDays = Math.max(minDays, Math.round(zone.delivery_eta_max * unitDays));

  return {
    start: addWorkingDays(dispatch, minDays, workingDays),
    end: addWorkingDays(dispatch, maxDays, workingDays),
  };
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' };
const DAY_FORMAT: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', timeZone: 'UTC' };

/** "Tue 12 Sept" for a single date, "Tue 12 – Thu 14 Sept" within a month,
 * "Tue 30 Sept – Thu 2 Oct" across a month boundary. */
export function formatDeliveryWindow(start: Date, end: Date): string {
  const full = new Intl.DateTimeFormat('en-GB', DATE_FORMAT);
  if (start.getTime() === end.getTime()) return full.format(start);

  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  if (sameMonth) {
    const dayOnly = new Intl.DateTimeFormat('en-GB', DAY_FORMAT);
    return `${dayOnly.format(start)} – ${full.format(end)}`;
  }

  return `${full.format(start)} – ${full.format(end)}`;
}

/** How long until this zone's cutoff today, in whole minutes — null once the
 * cutoff has passed or the zone has none. Used for the "order within Xh Ym for
 * dispatch today" countdown on the product page. */
export function minutesUntilCutoffToday(now: Date, zone: ScheduleZone): number | null {
  if (zone.order_cutoff_time == null) return null;
  if (!isWorkingDay(startOfUtcDate(now), zone.working_days?.length ? zone.working_days : DEFAULT_WORKING_DAYS)) {
    return null;
  }

  const [h, m, s] = zone.order_cutoff_time.split(':').map(Number);
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, s || 0));
  const diffMs = cutoff.getTime() - now.getTime();
  return diffMs > 0 ? Math.floor(diffMs / 60000) : null;
}
