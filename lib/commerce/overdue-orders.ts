/**
 * COMMERCE layer — which confirmed delivery orders have sat past their zone's
 * ETA window, i.e. someone forgot to mark them shipped.
 *
 * The rule itself is getShippingOverdueInfo(); this is the query around it,
 * shared by the alerts ticker and the admin orders list's "Overdue" filter so
 * the badge count and the filtered list can never disagree.
 *
 * Overdue cannot be expressed as a WHERE clause: the deadline depends on which
 * shipping zone matches the order's state / LGA / place, and zone matching
 * lives in TypeScript. So the candidate set is narrowed in SQL to the only
 * orders that could possibly qualify — confirmed, delivery — and the rule is
 * applied to that. That set is small by construction: an order stops being a
 * candidate the moment it is marked shipped.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getShippingOverdueInfo } from './shipping-overdue';
import { narrowOrderFields, narrowShippingZones } from './db-narrowing';

interface OverdueCandidateRow {
  id: string;
  order_number: string;
  customer_name: string;
  updated_at: string;
  status: string;
  delivery_option: string;
  selected_state: string | null;
  selected_lga: string | null;
  selected_place: string | null;
}

export interface OverdueOrder {
  id: string;
  order_number: string;
  customer_name: string;
  hoursOverdue: number;
}

const CANDIDATE_COLUMNS =
  'id, order_number, customer_name, updated_at, status, delivery_option, selected_state, selected_lga, selected_place';

/** Worst first, so a caller that only shows a few shows the ones that matter. */
export async function findOverdueOrders(supabase: SupabaseClient): Promise<OverdueOrder[]> {
  const [{ data: orders, error: ordersError }, { data: zones, error: zonesError }] = await Promise.all([
    supabase
      .from('orders')
      .select(CANDIDATE_COLUMNS)
      .eq('status', 'confirmed')
      .eq('delivery_option', 'delivery'),
    supabase.from('shipping_zones').select('*, shipping_zone_exceptions(*)'),
  ]);

  if (ordersError || zonesError) {
    console.error('Error resolving overdue orders:', ordersError || zonesError);
    return [];
  }

  const narrowedZones = narrowShippingZones(zones);

  return ((orders ?? []) as unknown as OverdueCandidateRow[])
    .flatMap((order) => {
      const info = getShippingOverdueInfo(narrowOrderFields(order), narrowedZones);
      if (!info) return [];
      return [{
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        hoursOverdue: info.hoursOverdue,
      }];
    })
    .sort((a, b) => b.hoursOverdue - a.hoursOverdue);
}
