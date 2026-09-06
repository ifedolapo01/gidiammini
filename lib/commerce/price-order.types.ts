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

/** A redemption code that was accepted, and what it was worth. */
export interface AppliedCode {
  code: string;
  discount_id: string;
  /** Naira taken off the items by this code specifically — 0 for a
   *  FREE_SHIPPING code, and 0 for a code that lost to a better sale on every
   *  line. The checkout says so rather than leaving the customer guessing. */
  saved_on_items: number;
  /** Delivery fee waived by this code. */
  saved_on_shipping: number;
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
  /** The code that was accepted, or null. */
  applied_code: AppliedCode | null;
  /** Why a supplied code was not applied. Null when none was supplied or it
   *  was accepted. Not an error status: the rest of the quote is valid and the
   *  customer should still see their total. */
  code_error: string | null;
}

export interface PriceOrderInput {
  items: unknown;
  deliveryOption: unknown;
  selectedState: unknown;
  selectedLga?: unknown;
  selectedPlace?: unknown;
  /** A redemption code the customer typed. Untrusted, like everything else
   *  here — validated server-side against the live discount row. */
  discountCode?: unknown;
  /** Needed only for a code's per-customer limit, which is counted by email
   *  because a guest checkout has no customer row yet. */
  customerEmail?: unknown;
}

export type PriceOrderResult =
  | { ok: true; priced: PricedOrder; products: Product[] }
  | { ok: false; error: string; status: number };
