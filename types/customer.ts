// types/customer.ts
//
// The buyer as the Admin sees them. Split from types/order.ts because a
// customer outlives any one order — that is the entire reason the entity
// exists (see migration 20251101002500) — and a type that lived beside orders
// would keep inviting code to treat the two as the same thing.

/**
 * A row of customer_stats: the identity plus the figures derived from orders
 * on read.
 *
 * Every count and total is nullable because it comes from a view whose LEFT
 * JOIN produces no rows for a customer who has never ordered. Treating them as
 * numbers without the null would render "NaN" on exactly the customers the
 * shop most wants to notice.
 */
export interface CustomerSummary {
  customer_id: string;
  email: string;
  full_name: string | null;
  phone_e164: string | null;
  is_blocked: boolean;
  orders_total: number | null;
  /** Orders that count toward revenue: everything but pending and cancelled. */
  orders_revenue: number | null;
  orders_cancelled: number | null;
  /** Gross: what this buyer has ever agreed to pay. */
  lifetime_value: number | null;
  /** What the shop kept, after refunds. */
  net_lifetime_value: number | null;
  lifetime_refunded: number | null;
  first_order_at: string | null;
  last_order_at: string | null;
  tags: string[] | null;
}

/** The detail view adds the columns only the editor needs. */
export interface CustomerDetail extends CustomerSummary {
  notes: string | null;
  blocked_reason: string | null;
  phone_raw: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** One of this buyer's orders, as the history list shows it. */
export interface CustomerOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  amount_paid: number | null;
  amount_refunded: number | null;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_option: 'pickup' | 'delivery' | string;
}

/** A row of customer_addresses: somewhere a parcel has actually been sent. */
export interface CustomerAddress {
  delivery_address: string | null;
  city: string | null;
  selected_state: string | null;
  selected_lga: string | null;
  times_used: number | null;
  last_used_at: string | null;
}

/** A saved product, with whatever the catalogue currently says about it. */
export interface CustomerWishlistEntry {
  product_id: string;
  created_at: string;
  products: {
    name: string;
    price: number;
    stock: number | null;
    main_image: string | null;
  } | null;
}
