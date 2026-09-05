/**
 * COMMERCE layer — the admin orders list, read from the database one page at a
 * time.
 *
 * This replaces a `select('*, order_items(*), order_change_requests(*),
 * order_status_history(*)')` with no limit. That query returned every order
 * ever placed, with three relations attached, to a client that then filtered
 * and searched it in JavaScript — and a 60-second poll repeated it per open
 * tab. Filtering, searching, sorting, counting and paging all happen here now.
 *
 * The projection is deliberately lean. order_items stays, because the card
 * shows the first two lines of every order and a second round-trip per row
 * would be worse. order_status_history and the full change-request rows do not:
 * they are only ever read inside the details modal, which fetches the one order
 * it is showing (GET /api/orders/[id]). What the list keeps instead is a single
 * boolean per row for the "Pending Request" badge.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseListParams, listMeta, ilikeAcross, type ListMeta } from '@/lib/api/list-params';
import { ORDER_STATUSES } from './order-status';
import { findOverdueOrders } from './overdue-orders';
import { phoneSearchTerm } from './phone-search';

export const ADMIN_ORDER_SORTABLE = [
  'created_at',
  'updated_at',
  'total_amount',
  'customer_name',
  'status',
] as const;

const SEARCH_COLUMNS = ['order_number', 'customer_name', 'customer_email', 'customer_phone'] as const;

/** Everything the orders list renders, and nothing it does not. */
const LIST_COLUMNS = `
  id, order_number, customer_name, customer_email, customer_phone,
  total_amount, status, delivery_option, selected_state, selected_lga,
  selected_place, shipping_zone_id, payment_verified, payment_method,
  payment_channel, paid_at, created_at, updated_at, receipt_path,
  delivery_address, city, note,
  order_items ( product_name, price, quantity, size, color )
`;

/**
 * A ceiling on the "Overdue" filter's id list. Overdue orders are confirmed
 * deliveries nobody has shipped, so in a healthy shop this is a handful; a
 * four-figure list would mean something is very wrong, and sending it all
 * through a PostgREST `in.(...)` would produce a URL no proxy will accept.
 */
const MAX_OVERDUE_IDS = 1000;

export interface AdminOrdersPage {
  orders: any[];
  meta: ListMeta;
}

function emptyPage(page: number, limit: number): AdminOrdersPage {
  return { orders: [], meta: { page, limit, total: 0, totalPages: 0, hasMore: false } };
}

/**
 * Which of these orders have a change request waiting on a decision.
 *
 * One extra query for the page rather than embedding every change request on
 * every row: the card needs one boolean, and the modal fetches the real rows
 * when someone opens it.
 */
async function pendingChangeRequestIds(supabase: SupabaseClient, orderIds: string[]): Promise<Set<string>> {
  if (orderIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from('order_change_requests')
    .select('order_id')
    .eq('status', 'pending')
    .in('order_id', orderIds);

  if (error) {
    // A missing badge is not worth failing the page for.
    console.error('Error loading pending change requests:', error);
    return new Set();
  }

  return new Set((data ?? []).map((row: any) => row.order_id));
}

export async function fetchAdminOrders(supabase: SupabaseClient, url: URL): Promise<AdminOrdersPage> {
  const params = parseListParams(url, {
    sortable: ADMIN_ORDER_SORTABLE,
    defaultSort: 'created_at',
    defaultDirection: 'desc',
  });

  const status = url.searchParams.get('status');

  let query = supabase
    .from('orders')
    .select(LIST_COLUMNS, { count: 'exact' })
    .order(params.sort, { ascending: params.ascending })
    // A stable tiebreaker. Two orders created in the same millisecond would
    // otherwise be free to swap places between pages and appear twice or not
    // at all.
    .order('id', { ascending: true })
    .range(params.from, params.to);

  if (status === 'overdue') {
    const overdue = await findOverdueOrders(supabase);
    if (overdue.length === 0) return emptyPage(params.page, params.limit);
    query = query.in('id', overdue.slice(0, MAX_OVERDUE_IDS).map((order) => order.id));
  } else if (status && status !== 'all' && (ORDER_STATUSES as string[]).includes(status)) {
    query = query.eq('status', status);
  }

  if (params.search) {
    // A number typed in any format also matches the normalised column, so
    // "0809 653" finds an order stored as "+2348096539067". See
    // lib/commerce/phone-search.ts.
    const digits = phoneSearchTerm(params.search);
    const clauses = [ilikeAcross(SEARCH_COLUMNS, params.search)];
    if (digits) clauses.push(`customer_phone_digits.ilike.*${digits}*`);

    query = query.or(clauses.join(','));
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const orders = data ?? [];
  const pending = await pendingChangeRequestIds(supabase, orders.map((order: any) => order.id));

  return {
    orders: orders.map((order: any) => ({
      ...order,
      has_pending_change_request: pending.has(order.id),
    })),
    meta: listMeta(params, count ?? 0),
  };
}
