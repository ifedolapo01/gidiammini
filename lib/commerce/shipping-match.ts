/** COMMERCE layer — resolves the best-matching shipping zone for a customer's
 * State / LGA / District-Town selection. Precedence: district-scoped zone >
 * LGA-wide zone > state-wide zone, so areas nearer/further from the pickup hub
 * can carry different fees, pickup availability, and ETAs. A matched zone's
 * own exceptions (ShippingZoneException) are then applied on top, overriding
 * only fee/ETA for an even narrower carve-out. */

import type { ShippingZone, ShippingZoneException } from '@/types/shipping';

function placesMatch(places: string | null, place: string): boolean {
  const needle = place.trim().toLowerCase();
  if (!places || !needle) return false;

  return places
    .split(/[,\n]/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
    .some((p) => p === needle || p.includes(needle) || needle.includes(p));
}

/** Distinct states the admin has actually configured at least one active zone
 * for — customers should only ever be offered these, not the full country. */
export function getAvailableStates(zones: ShippingZone[]): string[] {
  const states = new Set(zones.filter((z) => z.is_active).map((z) => z.state));
  return [...states].sort();
}

/** Human-readable "State › LGA › Places" path for a zone, e.g. in admin dropdowns/tables. */
export function formatZoneLocation(zone: ShippingZone): string {
  if (!zone.lga) return zone.state;
  if (!zone.places) return `${zone.state} › ${zone.lga}`;

  const places = zone.places
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter(Boolean);

  return `${zone.state} › ${zone.lga} › ${places.join(', ')}`;
}

/**
 * District/town names customers can pick from for a given State+LGA — derived
 * from whatever zones/exceptions the admin has already scoped to specific
 * places there. Empty when nothing narrower than the LGA has been configured,
 * so the storefront can skip the dropdown entirely in that case.
 */
export function getDistrictOptions(zones: ShippingZone[], state: string, lga: string): string[] {
  if (!lga) return [];

  const names = new Set<string>();
  const addPlaces = (places: string | null) => {
    if (!places) return;
    places.split(/[,\n]/).map((p) => p.trim()).filter(Boolean).forEach((p) => names.add(p));
  };

  for (const zone of zones) {
    if (!zone.is_active || zone.state !== state) continue;

    if (zone.lga === lga) {
      addPlaces(zone.places);
    }

    for (const exception of zone.shipping_zone_exceptions ?? []) {
      if (!exception.is_active) continue;
      const effectiveLga = exception.lga || zone.lga || '';
      if (effectiveLga === lga) {
        addPlaces(exception.places);
      }
    }
  }

  return [...names].sort();
}

function findBaseZone(
  zones: ShippingZone[],
  state: string,
  lga?: string,
  place?: string
): ShippingZone | undefined {
  const inState = zones.filter((z) => z.is_active && z.state === state);

  if (lga) {
    if (place) {
      const placeMatch = inState.find((z) => z.lga === lga && placesMatch(z.places, place));
      if (placeMatch) return placeMatch;
    }

    const lgaMatch = inState.find((z) => z.lga === lga && !z.places);
    if (lgaMatch) return lgaMatch;
  }

  return inState.find((z) => !z.lga);
}

function findMatchingException(
  exceptions: ShippingZoneException[],
  base: ShippingZone,
  lga?: string,
  place?: string
): ShippingZoneException | undefined {
  if (!lga) return undefined;

  const active = exceptions
    .filter((e) => e.is_active)
    .map((e) => ({ exception: e, effectiveLga: e.lga || base.lga || '' }));

  if (place) {
    const placeMatch = active.find(({ exception, effectiveLga }) => effectiveLga === lga && placesMatch(exception.places, place));
    if (placeMatch) return placeMatch.exception;
  }

  const lgaMatch = active.find(({ exception, effectiveLga }) => effectiveLga === lga && !exception.places);
  return lgaMatch?.exception;
}

/**
 * Finds the matching zone for a State/LGA/Place selection, then layers on
 * that zone's best-matching exception (if any) — overriding only fee/ETA,
 * never pickup/address/phone/label, which always come from the base zone.
 */
export function resolveEffectiveZone(
  zones: ShippingZone[],
  state: string,
  lga?: string,
  place?: string
): ShippingZone | undefined {
  const base = findBaseZone(zones, state, lga, place);
  if (!base) return undefined;

  const exception = findMatchingException(base.shipping_zone_exceptions ?? [], base, lga, place);
  if (!exception) return base;

  return {
    ...base,
    delivery_fee: exception.delivery_fee ?? base.delivery_fee,
    delivery_eta_min: exception.delivery_eta_min ?? base.delivery_eta_min,
    delivery_eta_max: exception.delivery_eta_max ?? base.delivery_eta_max,
    delivery_eta_unit: exception.delivery_eta_unit ?? base.delivery_eta_unit,
  };
}
