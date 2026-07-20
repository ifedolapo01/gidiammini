/** COMMERCE layer — formats a shipping zone's structured (min, max, unit) ETA
 * into display copy, and aggregates a range across multiple zones (used by the
 * product page's "other states" delivery estimate). */

import type { ShippingEtaUnit, ShippingZone } from '@/types/shipping';

const UNIT_TO_DAYS: Record<ShippingEtaUnit, number> = { days: 1, weeks: 7, months: 30 };
const SINGULAR: Record<ShippingEtaUnit, string> = { days: 'day', weeks: 'week', months: 'month' };

export function formatEtaRange(min: number, max: number, unit: ShippingEtaUnit): string {
  const label = (n: number) => (n === 1 ? SINGULAR[unit] : unit);
  if (min === max) return `${min} ${label(min)}`;
  return `${min}-${max} ${label(max)}`;
}

export function formatZoneEta(zone: ShippingZone): string {
  return formatEtaRange(zone.delivery_eta_min, zone.delivery_eta_max, zone.delivery_eta_unit);
}

/** Smallest min to largest max across all given zones, in a single readable unit. */
export function aggregateEtaRange(zones: ShippingZone[]): string | null {
  const active = zones.filter((z) => z.is_active);
  if (active.length === 0) return null;

  const units = new Set(active.map((z) => z.delivery_eta_unit));
  if (units.size === 1) {
    const unit = active[0].delivery_eta_unit;
    const min = Math.min(...active.map((z) => z.delivery_eta_min));
    const max = Math.max(...active.map((z) => z.delivery_eta_max));
    return formatEtaRange(min, max, unit);
  }

  // Mixed units across zones — normalize to days so the aggregate stays coherent.
  const minDays = Math.min(...active.map((z) => z.delivery_eta_min * UNIT_TO_DAYS[z.delivery_eta_unit]));
  const maxDays = Math.max(...active.map((z) => z.delivery_eta_max * UNIT_TO_DAYS[z.delivery_eta_unit]));
  return formatEtaRange(minDays, maxDays, 'days');
}
