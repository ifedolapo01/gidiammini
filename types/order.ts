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
