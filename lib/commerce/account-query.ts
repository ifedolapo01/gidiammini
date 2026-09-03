/**
 * COMMERCE layer (server only) — everything a signed-in customer can read.
 *
 * WHICH ORDERS ARE THEIRS
 *
 * Two answers, and both are needed. orders.customer_id is the link the
 * customers table introduced, but every order placed before that migration
 * has it NULL — and those are exactly the orders a returning customer wants to
 * see. So the match is customer_id OR the email snapshot on the order.
 *
 * That is safe precisely because of how the session was obtained: the sign-in
 * link went to this address and nowhere else, so "orders whose customer_email
 * is this address" is the same set verifyOrderContact would have allowed one
 * at a time. This feature widens that check from one order to all of them; it
 * does not loosen it.
 *
 * Phone is deliberately not part of the match. The customers table documents
 * one number shared by two different email addresses, so matching on phone
 * would show one person another's orders.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_VARIANTS_SELECT } from './product-variants';
import { buildReorderLines, type PastOrderLine, type ReorderResult } from './customer-account';
import type { SignedInCustomer } from './customer-auth';
import type { Product } from '@/types/product';

/** What the account list renders. No receipt path, no internal notes. */
const ORDER_SELECT = `
  id, order_number, created_at, status, total_amount, delivery_option,
  selected_state, city, delivery_address, customer_name, customer_phone,
  order_items ( product_id, product_name, price, quantity, size, color )
`;

/** How many orders the account page shows. Beyond this is history nobody
 *  scrolls to, and the list is not paginated. */
const ORDER_LIMIT = 40;

export interface AccountOrderLine {
  product_id: string | null;
  product_name: string;
  price: number;
  quantity: number;
  size: string | null;
  color: string | null;
}

export interface AccountOrder {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  total_amount: number;
  delivery_option: string;
  order_items: AccountOrderLine[];
}

/**
 * The or-filter this uses is built from the session's own customer row, not
 * from anything in the request — so the email interpolated into it is a value
 * the database itself validated on insert.
 */
function ownedBy(customer: SignedInCustomer): string {
  return `customer_id.eq.${customer.id},customer_email.ilike.${customer.email}`;
}

export async function loadCustomerOrders(
  supabase: SupabaseClient,
  customer: SignedInCustomer
): Promise<AccountOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .or(ownedBy(customer))
    .order('created_at', { ascending: false })
    .limit(ORDER_LIMIT);

  if (error) {
    console.error(`Order history load failed for ${customer.id}:`, error.message);
    return [];
  }

  return (data ?? []) as unknown as AccountOrder[];
}

/** The delivery details checkout prefills from — the most recent order that
 *  actually had an address, so a pickup order does not blank the form. */
export interface SavedDetails {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  deliveryOption: string;
}

export async function loadSavedDetails(
  supabase: SupabaseClient,
  customer: SignedInCustomer
): Promise<SavedDetails | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('customer_name, customer_phone, delivery_address, city, selected_state, delivery_option, created_at')
    .or(ownedBy(customer))
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error(`Saved details load failed for ${customer.id}:`, error.message);
    return null;
  }

  const orders = (data ?? []) as Array<Record<string, string | null>>;
  if (orders.length === 0) return null;

  // The newest order for the name and number; the newest order that carried an
  // address for the address. A customer whose last order was a pickup still
  // has a delivery address worth offering.
  const latest = orders[0];
  const withAddress = orders.find((order) => (order.delivery_address ?? '').trim() !== '') ?? latest;

  return {
    fullName: latest.customer_name ?? '',
    email: customer.email,
    phone: latest.customer_phone ?? customer.phone ?? '',
    address: withAddress.delivery_address ?? '',
    city: withAddress.city ?? '',
    state: withAddress.selected_state ?? '',
    deliveryOption: latest.delivery_option ?? 'delivery',
  };
}

export type ReorderOutcome =
  | { ok: true; result: ReorderResult }
  | { ok: false; reason: 'not_found' };

/**
 * One-tap reorder: the lines of a past order, re-priced against the catalogue
 * as it is today.
 *
 * The ownership filter is applied to the order lookup itself rather than
 * checked afterwards, so an id belonging to somebody else reads as "no such
 * order" — which is both the truth from this session's point of view and no
 * use to somebody enumerating ids.
 */
export async function buildReorder(
  supabase: SupabaseClient,
  customer: SignedInCustomer,
  orderId: string
): Promise<ReorderOutcome> {
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_items ( product_id, product_name, price, quantity, size, color )')
    .eq('id', orderId)
    .or(ownedBy(customer))
    .maybeSingle();

  const lines = ((order as unknown as { order_items?: PastOrderLine[] } | null)?.order_items ?? []);
  if (!order) return { ok: false, reason: 'not_found' };

  const productIds = [...new Set(lines.map((line) => line.product_id).filter(Boolean))] as string[];

  if (productIds.length === 0) {
    return { ok: true, result: buildReorderLines(lines, []) };
  }

  // Variants embedded: the price and stock of the exact size/colour bought is
  // what decides whether this line can come back, and at what price.
  const { data: products, error } = await supabase
    .from('products')
    .select(`*,${PUBLIC_VARIANTS_SELECT}`)
    .in('id', productIds);

  if (error) {
    console.error(`Reorder product load failed for order ${orderId}:`, error.message);
    return { ok: true, result: buildReorderLines(lines, []) };
  }

  return { ok: true, result: buildReorderLines(lines, (products ?? []) as unknown as Product[]) };
}
