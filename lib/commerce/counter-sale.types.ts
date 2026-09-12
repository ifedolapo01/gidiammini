/**
 * COMMERCE layer — shapes for a counter sale: an in-person, walk-in order rung
 * up in Admin. Split from create-counter-sale.ts the same way
 * price-order.types.ts is split from price-order.ts, so the pricer and its
 * consumers can share types without pulling in a Supabase dependency.
 */
import type { PricedLine } from './price-order.types';

export type { PricedLine };

/** What the counter-sale screen is allowed to submit. Unlike an online
 *  checkout, there is no delivery address, no discount code input, and every
 *  identity field is optional — a walk-in customer paying cash may give none
 *  of them. */
export interface CounterSaleSubmission {
  items?: unknown;
  customer_name?: unknown;
  customer_email?: unknown;
  customer_phone?: unknown;
  payment_method: 'cash' | 'pos';
  idempotency_key: unknown;
}

/** The priced result of a counter sale. Slimmer than PricedOrder: there is no
 *  delivery option, no zone, no promised delivery window, and shipping is
 *  always 0 — the goods leave with the customer, they are never sent. */
export interface CounterSalePriced {
  items: PricedLine[];
  subtotal: number;
  tax: number;
  shipping: 0;
  total: number;
}
