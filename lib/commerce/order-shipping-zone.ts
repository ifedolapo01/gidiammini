/** COMMERCE layer — resolves the shipping zone matching an order's saved
 * state/LGA/place. Shared by the confirmed-order delivery-ETA text and the
 * order-change-request pickup-eligibility/approval flows, so both look up
 * "what zone actually applies to this order" the same way. */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ShippingZone } from '@/types/shipping';
import { findShippingZone } from './checkout';

export async function resolveOrderShippingZone(
  supabase: SupabaseClient,
  order: { selected_state?: string | null; selected_lga?: string | null; selected_place?: string | null }
): Promise<ShippingZone | undefined> {
  const { data: zones } = await supabase.from('shipping_zones').select('*, shipping_zone_exceptions(*)');
  return findShippingZone(zones || [], order.selected_state ?? '', order.selected_lga ?? undefined, order.selected_place ?? undefined);
}
