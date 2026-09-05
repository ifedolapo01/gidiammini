// types/order.ts

import type { OrderChangeRequest } from './orderChangeRequest';

/** Single source of truth for every valid order status — see
 * lib/commerce/order-status.ts for the ordered list, display formatting,
 * icons/colors, and status-transition helpers built on this type. */
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'rescheduled'
  | 'shipped'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'delivered'
  | 'cancelled';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  size?: string;
  color?: string;
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id?: string;
  product_name: string;
  price: number;
  quantity: number;
  size: string | null;
  color: string | null;
}

export interface OrderData {
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_amount: number;
  delivery_option: 'pickup' | 'delivery';
  selected_state: string;
  selected_lga?: string | null;
  selected_place?: string | null;
  shipping_zone_id?: string | null;
  delivery_address?: string;
  city?: string;
  note?: string;
  /** Object path inside the private 'receipts' bucket. Never a URL. */
  receipt_path?: string;
  items: OrderItem[];
}

/** One row per status transition — see lib/commerce/order-status-transition.ts. */
export interface OrderStatusHistoryEntry {
  id: string;
  order_id: string;
  status: OrderStatus;
  changed_at: string;
  /** Who moved it. Null for the transitions nothing human made. */
  actor_email?: string | null;
  /** Why, in the admin's own words. */
  reason?: string | null;
  /** Why, from the fixed vocabulary — see lib/commerce/cancellation-reasons.ts. */
  reason_code?: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_amount: number;
  status: OrderStatus;
  delivery_option: 'pickup' | 'delivery';
  selected_state: string;
  selected_lga?: string | null;
  selected_place?: string | null;
  shipping_zone_id?: string | null;
  payment_verified: boolean;
  /**
   * The money breakdown behind total_amount.
   *
   * total_amount = items_subtotal + tax_amount + shipping_amount - discount_amount,
   * enforced by a CHECK constraint (migration 20260905190000). Optional on this
   * type only because a few narrow projections do not select them.
   */
  items_subtotal?: number;
  tax_amount?: number;
  shipping_amount?: number;
  /** A manual reduction an admin applied after the order was placed. A
   * catalogue discount is already inside order_items.price and is not this. */
  discount_amount?: number;
  discount_reason?: string | null;
  /** Sum of non-rejected payments, maintained by trigger. */
  amount_paid?: number;
  /** Sum of completed refunds, maintained by trigger. Net received is
   * amount_paid - amount_refunded. */
  amount_refunded?: number;
  /** Courier key from lib/commerce/order-tracking.ts, or free text. */
  carrier?: string | null;
  tracking_number?: string | null;
  /** Stored rather than derived, so a courier changing its URL format cannot
   * rewrite history. */
  tracking_url?: string | null;
  /** 'transfer' — a receipt somebody inspects — or 'paystack', verified by the
   *  provider's webhook. Defaulted in the database, so an order that predates
   *  online payment reads as a transfer. */
  payment_method?: 'transfer' | 'paystack';
  /** How they paid, in the provider's words: card, bank, ussd. */
  payment_channel?: string | null;
  /** When the provider confirmed the money. Null for a manual transfer. */
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
  /** Object path inside the private 'receipts' bucket — read it via the
   * admin receipt endpoint, which returns a short-lived signed URL. Never
   * render this directly as an image src. */
  receipt_path?: string | null;
  delivery_address?: string | null;
  city?: string | null;
  note?: string | null;
  order_items?: OrderItem[];
  /** Embedded via the orders -> order_change_requests relation. Present only
   * on the single-order detail fetch — the paged list sends the boolean below
   * instead, since the card only needs to know whether a badge is due. */
  order_change_requests?: OrderChangeRequest[];
  /** Set by the admin orders list. See order_change_requests above. */
  has_pending_change_request?: boolean;
  /** Embedded via the orders -> order_status_history relation. */
  order_status_history?: OrderStatusHistoryEntry[];
}

/** One refund on an order — see supabase/migrations/20260905190200. */
export interface OrderRefund {
  id: string;
  /** 'pending' is agreed but not sent; only 'completed' is money returned. */
  status: 'pending' | 'completed' | 'failed';
  amount: number;
  method: string;
  reference: string | null;
  /** A RefundCode — see lib/commerce/refund-reasons.ts. */
  reason_code: string;
  note: string | null;
  /** When the money actually moved. Null while pending. */
  refunded_at: string | null;
  actor_email: string | null;
  created_at: string;
}

/** What the refund panel needs to know before it can offer a figure. */
export interface OrderRefundTotals {
  total_amount: number;
  amount_paid: number;
  amount_refunded: number;
  /** What arrived, less what has gone back. The ceiling on a new refund. */
  refundable: number;
}
