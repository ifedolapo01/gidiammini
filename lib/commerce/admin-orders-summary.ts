/**
 * COMMERCE layer — the four figures above the admin orders list, and the
 * cheap "has anything changed?" token the page polls on.
 *
 * The summary used to be derived in the browser from the full orders array,
 * which is only possible if the browser holds every order. Once the list is
 * paged, the totals have to come from the database — otherwise "Total Orders"
 * would read 25.
 *
 * The cursor exists so the page can stay live without re-downloading a page of
 * orders every minute. It is two head-only queries — a count and the newest
 * updated_at — and transfers no rows at all. The client refetches the list only
 * when the token it holds stops matching.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { findOverdueOrders } from './overdue-orders';

export interface AdminOrdersSummary {
  total: number;
  pending: number;
  paid: number;
  overdue: number;
  /** Naira, excluding cancelled orders. */
  revenue: number;
}

/**
 * Two round trips, zero rows. `head: true` asks PostgREST for the count in a
 * Content-Range header and nothing else.
 */
export async function fetchOrdersChangeCursor(supabase: SupabaseClient): Promise<string> {
  const [{ count }, { data }] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('updated_at').order('updated_at', { ascending: false }).limit(1),
  ]);

  return `${count ?? 0}:${data?.[0]?.updated_at ?? ''}`;
}

/**
 * Counts come back as counts — no rows cross the wire for three of the four
 * figures. Revenue is the exception: PostgREST aggregate support is not
 * something this project can assume is enabled, so the one column is read and
 * summed here. It is a single narrow integer column over non-cancelled orders,
 * which is a different order of magnitude from the full-row-plus-three-
 * relations read this replaced — but it is the first thing to move into a
 * SQL function if the orders table ever reaches six figures.
 */
export async function fetchAdminOrdersSummary(supabase: SupabaseClient): Promise<AdminOrdersSummary> {
  const [
    { count: total },
    { count: pending },
    { count: paid },
    { data: revenueRows, error: revenueError },
    overdue,
  ] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('payment_verified', true),
    supabase.from('orders').select('total_amount').neq('status', 'cancelled'),
    findOverdueOrders(supabase),
  ]);

  if (revenueError) console.error('Error summing order revenue:', revenueError);

  const revenue = (revenueRows ?? []).reduce(
    (sum: number, row: any) => sum + (Number(row.total_amount) || 0),
    0
  );

  return {
    total: total ?? 0,
    pending: pending ?? 0,
    paid: paid ?? 0,
    overdue: overdue.length,
    revenue,
  };
}
