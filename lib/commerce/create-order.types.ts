/** COMMERCE layer — the shape of a checkout submission.
 *
 * Every field is `unknown` on purpose: this is what arrived from a browser,
 * and naming a type for it would invite somebody to trust it. Validation and
 * narrowing happen in create-order.ts and in priceOrder, which is the only
 * thing that decides an amount.
 *
 * Apart from create-order.ts so that file is the flow and this is the contract.
 */

export interface CreateOrderSubmission {
  /** One value per checkout attempt, minted by the browser. The order number is
   * derived from it server-side; the client never chooses either. */
  idempotency_key?: unknown;
  customer_name?: unknown;
  customer_email?: unknown;
  customer_phone?: unknown;
  /** The total the customer was shown. Compared, never stored. */
  expected_total?: unknown;
  delivery_option?: unknown;
  selected_state?: unknown;
  selected_lga?: unknown;
  selected_place?: unknown;
  delivery_address?: unknown;
  city?: unknown;
  note?: unknown;
  receipt_path?: unknown;
  items?: unknown;
  /** A redemption code, revalidated at pricing time rather than trusted. */
  discount_code?: unknown;
  /** 'transfer' (the default) or 'paystack'. Set by the route, never by the
   *  request: which endpoint was called is the only honest source for it. */
  payment_method?: 'transfer' | 'paystack';
}
