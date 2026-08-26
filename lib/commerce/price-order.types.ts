/**
 * COMMERCE layer — shapes returned by the server-side pricing authority.
 * Split from price-order.ts (which holds the logic) so both the pricing
 * engine and its consumers — the quote endpoint, order creation, and the
 * checkout hooks — can import the types without pulling in a Supabase
 * dependency. Mirrors the existing *.types.ts convention in
 * app/admin/shipping/hooks.
 */
import type { Product } from '@/types/product';
import type { DeliveryOption } from './cart-input';

export interface PricedLine {
  product_id: string;
  product_name: string;
  size: string | null;
  color: string | null;
  quantity: number;
  /** Catalogue price for this variant, before any discount. */
  base_price: number;
  /** Per-unit price actually charged, after the best applicable discount. */
  price: number;
  /** Which discount produced `price`, for audit. Null when none applied. */
  discount_id: string | null;
  /** Stock on hand for this variant at pricing time. */
  available_stock: number;
}

export interface PricedOrder {
  items: PricedLine[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  delivery_option: DeliveryOption;
  shipping_zone_id: string | null;
  /** The zone's canonical state, so callers store what was actually priced. */
  selected_state: string;
  selected_lga: string | null;
  selected_place: string | null;
  /** True when the resolved zone expects a street address (drop-off zones don't). */
  requires_address: boolean;
}

export interface PriceOrderInput {
  items: unknown;
  deliveryOption: unknown;
  selectedState: unknown;
  selectedLga?: unknown;
  selectedPlace?: unknown;
}

export type PriceOrderResult =
  | { ok: true; priced: PricedOrder; products: Product[] }
  | { ok: false; error: string; status: number };
