/** COMMERCE layer — shared checkout delivery/fee logic. Used by Storefront checkout flow.
 * Delivery fees, pickup availability, and copy are driven by admin-managed shipping
 * zones (types/shipping.ts, app/admin/shipping), matched by State/LGA/Place via
 * lib/commerce/shipping-match.ts, rather than hardcoded per-state rules. */

import type { ShippingZone } from '@/types/shipping';
import { resolveEffectiveZone as findShippingZone, getDistrictOptions, getAvailableStates } from './shipping-match';
import { formatZoneEta } from './shipping-eta';

/** Resolves the matching zone for a State/LGA/District-Town selection, with
 * that zone's own exceptions (fee/ETA-only carve-outs) already applied. */
export { findShippingZone, getDistrictOptions, getAvailableStates };

export const TAX_RATE = 0.075;

export type DeliveryOption = 'pickup' | 'delivery';

/** Delivery fee for the matched zone; 0 if nothing matches yet. */
export function getDeliveryFee(zones: ShippingZone[], state: string, lga?: string, place?: string): number {
  return findShippingZone(zones, state, lga, place)?.delivery_fee ?? 0;
}

/** Store pickup is only offered where the matched zone allows it. */
export function isPickupAvailable(zones: ShippingZone[], state: string, lga?: string, place?: string): boolean {
  return !!findShippingZone(zones, state, lga, place)?.pickup_available;
}

type DeliveryMethod = 'pickup' | 'delivery';

function resolveDeliveryMethod(deliveryOption: DeliveryOption, pickupAvailable: boolean): DeliveryMethod {
  return deliveryOption === 'pickup' && pickupAvailable ? 'pickup' : 'delivery';
}

export type DeliveryLabelFormat = 'badge' | 'arrangementTitle' | 'arrangementLower' | 'detailLabel';

const DELIVERY_LABELS: Record<DeliveryLabelFormat, Record<DeliveryMethod, string>> = {
  badge: {
    pickup: 'Pickup',
    delivery: 'Delivery',
  },
  arrangementTitle: {
    pickup: 'Pickup Arrangement',
    delivery: 'Delivery Arrangement',
  },
  arrangementLower: {
    pickup: 'Pickup arrangement',
    delivery: 'Delivery arrangement',
  },
  detailLabel: {
    pickup: 'Pickup Location',
    delivery: 'Delivery Address',
  },
};

interface ZoneLocation {
  lga?: string;
  place?: string;
}

/**
 * Resolves the delivery-method label text shared across OrderSummary, PaymentStep,
 * and ConfirmationStep. `format` picks which copy variant is needed; `location`
 * narrows the zone match beyond state alone (omit it to fall back to the state-wide zone).
 */
export function getDeliveryLabel(
  deliveryOption: DeliveryOption,
  zones: ShippingZone[],
  state: string,
  format: DeliveryLabelFormat = 'badge',
  location?: ZoneLocation
): string {
  const zone = findShippingZone(zones, state, location?.lga, location?.place);
  const method = resolveDeliveryMethod(deliveryOption, !!zone?.pickup_available);

  if (format === 'detailLabel' && method === 'delivery' && zone && !zone.is_door_delivery) {
    return 'Drop-off Location';
  }

  return DELIVERY_LABELS[format][method];
}

export type DeliveryDescriptionKind = 'nextSteps' | 'infoPanel';

interface DeliveryDescriptionContext {
  address?: string;
  city?: string;
  lga?: string;
  place?: string;
}

/**
 * Resolves the longer delivery-method prose shared across ConfirmationStep's
 * "What Happens Next" copy and StateDeliveryForm's delivery info panel. Uses the
 * matched zone's own label/ETA/pickup address instead of a hardcoded state name.
 */
export function getDeliveryDescription(
  deliveryOption: DeliveryOption,
  zones: ShippingZone[],
  state: string,
  ctx: DeliveryDescriptionContext,
  kind: DeliveryDescriptionKind = 'nextSteps'
): string {
  const { address = '', city = '', lga, place } = ctx;
  const zone = findShippingZone(zones, state, lga, place);
  const method = resolveDeliveryMethod(deliveryOption, !!zone?.pickup_available);
  const deliveryLabel = (zone?.delivery_label || 'Delivery').toLowerCase();
  const eta = zone ? ` Estimated: ${formatZoneEta(zone)}.` : '';

  if (kind === 'infoPanel') {
    if (method === 'pickup') {
      return `Collect your order from our store in ${state}. We'll contact you when your order is ready for pickup.`;
    }
    return `Your order will be sent via ${deliveryLabel} in ${state}.${eta}`;
  }

  // nextSteps
  if (method === 'pickup') {
    return `You'll be contacted to arrange pickup from ${zone?.pickup_address ?? ''}`;
  }
  if (zone && !zone.is_door_delivery) {
    return `Your items will be sent via ${deliveryLabel} to ${state}. We'll contact you with collection details.${eta}`;
  }
  return `Your items will be delivered to ${address}, ${city}, ${state} via ${deliveryLabel}.${eta}`;
}
