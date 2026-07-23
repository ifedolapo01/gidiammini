/** COMMERCE layer — determines whether a confirmed delivery order has sat
 * past its shipping zone's ETA window, i.e. the admin likely forgot to move
 * it to 'shipped'. Pure/sync so it runs against already-fetched zones on
 * both the overdue-shipments alert route and the admin orders list. */
import type { ShippingZone } from '@/types/shipping';
import { findShippingZone } from './checkout';
import { etaMaxHours } from './shipping-eta';

interface OverdueCheckOrder {
  status: string;
  delivery_option: 'pickup' | 'delivery';
  selected_state?: string | null;
  selected_lga?: string | null;
  selected_place?: string | null;
  updated_at: string;
}

export interface ShippingOverdueInfo {
  hoursOverdue: number;
}

/** Returns overdue info, or null if the order isn't a confirmed delivery
 * order, has no matching zone, or is still within its ETA window. */
export function getShippingOverdueInfo(
  order: OverdueCheckOrder,
  zones: ShippingZone[]
): ShippingOverdueInfo | null {
  if (order.status !== 'confirmed' || order.delivery_option !== 'delivery') return null;

  const zone = findShippingZone(
    zones,
    order.selected_state ?? '',
    order.selected_lga ?? undefined,
    order.selected_place ?? undefined
  );
  if (!zone) return null;

  const hoursSinceConfirmed = (Date.now() - new Date(order.updated_at).getTime()) / (1000 * 60 * 60);
  const maxHours = etaMaxHours(zone);
  if (hoursSinceConfirmed <= maxHours) return null;

  return { hoursOverdue: Math.round(hoursSinceConfirmed - maxHours) };
}
