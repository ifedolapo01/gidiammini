// types/order.ts

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
  receipt_url?: string;
  items: OrderItem[];
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
  created_at: string;
  updated_at: string;
  receipt_url?: string | null;
  delivery_address?: string | null;
  city?: string | null;
  note?: string | null;
  order_items?: OrderItem[];
}
