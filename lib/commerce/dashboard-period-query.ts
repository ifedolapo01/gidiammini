/**
 * COMMERCE layer (server only) — the reads behind the dashboard's period view.
 *
 * Kept apart from the pure arithmetic in period-metrics.ts and
 * revenue-breakdown.ts so those stay testable without a database, and apart
 * from the route so the route stays a thin shell.
 *
 * THE PRIOR-CUSTOMER SET IS THE EXPENSIVE PART
 *
 * "Is this a repeat customer" cannot be answered from the window alone — it
 * needs to know whether that person ever ordered before it opened. That is one
 * query over all history, selecting two narrow columns and nothing else. It is
 * capped, and the cap is stated in the response so a shop that outgrows it
 * finds out rather than quietly reading a wrong rate.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DateRange } from './date-range';
import type { PeriodOrder } from './period-metrics';

/** Ceiling on rows in any one read. A shop past this needs the aggregation
 *  pushed into SQL rather than a slower version of this. */
export const MAX_ROWS = 20000;

const PERIOD_COLUMNS =
  'id, created_at, status, total_amount, amount_paid, amount_refunded,' +
  ' customer_id, customer_email, shipping_amount, shipping_zone_id, selected_state';

export interface PeriodOrderRow extends PeriodOrder {
  shipping_amount: number | null;
  shipping_zone_id: string | null;
  selected_state: string | null;
}

export async function fetchPeriodOrders(
  supabase: SupabaseClient,
  range: DateRange
): Promise<PeriodOrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(PERIOD_COLUMNS)
    .gte('created_at', range.from)
    .lt('created_at', range.to)
    .limit(MAX_ROWS);

  if (error) throw error;
  return (data ?? []) as unknown as PeriodOrderRow[];
}

/**
 * Everyone who had ordered before `before`.
 *
 * Both identities are collected — customer_id and lower-cased email — because
 * summarisePeriod falls back from one to the other, and a set holding only ids
 * would call every guest who has bought twice a new customer.
 */
export async function fetchPriorCustomers(
  supabase: SupabaseClient,
  before: string
): Promise<{ identities: Set<string>; truncated: boolean }> {
  const { data, error } = await supabase
    .from('orders')
    .select('customer_id, customer_email')
    .lt('created_at', before)
    .limit(MAX_ROWS);

  if (error) throw error;

  const identities = new Set<string>();
  for (const row of (data ?? []) as { customer_id: string | null; customer_email: string | null }[]) {
    if (row.customer_id) identities.add(row.customer_id);
    const email = row.customer_email?.trim().toLowerCase();
    if (email) identities.add(email);
  }

  return { identities, truncated: (data?.length ?? 0) >= MAX_ROWS };
}

export interface CategoryLineRow {
  price: number;
  quantity: number;
  products: { category: string | null } | null;
}

/**
 * The lines sold in a window, with the category of each.
 *
 * Filtered on the *order's* created_at rather than the line's, so a line
 * belongs to the period its order was placed in — order_items.created_at is
 * the row's own insert time and would put an edited line in the wrong month.
 */
export async function fetchCategoryLines(
  supabase: SupabaseClient,
  range: DateRange,
  revenueStatuses: readonly string[]
): Promise<CategoryLineRow[]> {
  const { data, error } = await supabase
    .from('order_items')
    .select('price, quantity, orders!inner(created_at, status), products(category)')
    .gte('orders.created_at', range.from)
    .lt('orders.created_at', range.to)
    .in('orders.status', revenueStatuses as string[])
    .limit(MAX_ROWS);

  if (error) throw error;
  return (data ?? []) as unknown as CategoryLineRow[];
}

/** Zone id to name, for labelling the zone breakdown. */
export async function fetchZoneNames(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await supabase.from('shipping_zones').select('id, name');
  return new Map((data ?? []).map((zone: any) => [zone.id as string, zone.name as string]));
}
