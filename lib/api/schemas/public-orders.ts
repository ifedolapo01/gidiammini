/**
 * Request schemas for the public order endpoints: tracking an order,
 * messaging on one, and re-pricing/placing a cart.
 *
 * `orderChangeRequestSchema` lives in ./order-change-request.ts — split out
 * once this file passed the 200-line cap.
 *
 * `items` is deliberately left as `unknown` here: lib/commerce/cart-input.ts is
 * already the trust boundary for cart lines, with its own tests, per-line
 * quantity caps and duplicate-line merging. Restating that in zod would create
 * a second definition of a valid cart line that could drift from the one the
 * pricing actually uses.
 */
import { z } from 'zod';
import { MAX_LENGTHS, contactField, optionalText, orderNumberField, requiredText } from './common';

export const trackOrderSchema = z.object({
  orderNumber: orderNumberField,
  contact: contactField,
});

export type TrackOrderBody = z.infer<typeof trackOrderSchema>;

/** A customer posting into the conversation on their own order — same trust
 *  model as trackOrderSchema (order number + the contact used at checkout). */
export const orderMessageSchema = z.object({
  orderNumber: orderNumberField,
  contact: contactField,
  body: requiredText('Message', MAX_LENGTHS.message),
});

export type OrderMessageBody = z.infer<typeof orderMessageSchema>;

/**
 * Where the order is going. Shared by the quote and create-order bodies — the
 * same five fields drive `priceOrder` in both.
 *
 * `.optional()` is load-bearing: in zod 4 a bare `z.unknown()` rejects a key
 * that is absent entirely, and a pickup order legitimately sends no LGA or
 * place. Without it every pickup checkout would 400.
 */
const destinationFields = {
  items: z.unknown().optional(),
  delivery_option: z.unknown().optional(),
  selected_state: z.unknown().optional(),
  selected_lga: z.unknown().optional(),
  selected_place: z.unknown().optional(),
  /**
   * A redemption code the customer typed.
   *
   * Deliberately not shape-checked here. normaliseCode() in
   * lib/commerce/discount-code.ts owns what a code looks like, and rejecting a
   * mistyped one with a 400 would blank the whole quote — including the total
   * the customer is waiting for — over a field they can fix. An unusable code
   * comes back as `code_error` beside a valid price instead.
   */
  discount_code: optionalText('Discount code', 40),
};

export const checkoutQuoteSchema = z.object({
  ...destinationFields,
  /** Validated properly by isValidIdempotencyKey() downstream, which owns the
   * UUID rule; here it only has to be present and a string. */
  idempotency_key: z.string({ error: 'This checkout session is missing its reference.' }),
  /**
   * Optional, and used only to check the blocklist before the customer is
   * shown bank details. Without it a barred buyer would transfer money and
   * only be refused afterwards. Nothing is priced from it.
   */
  customer_email: optionalText('Your email', MAX_LENGTHS.email),
});

export type CheckoutQuoteBody = z.infer<typeof checkoutQuoteSchema>;

export const createOrderSchema = z.object({
  ...destinationFields,
  idempotency_key: z.string({ error: 'This checkout session is missing its reference.' }),
  customer_name: requiredText('Your name', MAX_LENGTHS.name),
  /** Format is checked by createCustomerOrder against the shared pattern. */
  customer_email: requiredText('Your email', MAX_LENGTHS.email),
  customer_phone: requiredText('Your phone number', MAX_LENGTHS.phone),
  delivery_address: optionalText('Delivery address', MAX_LENGTHS.address),
  city: optionalText('City', MAX_LENGTHS.city),
  note: optionalText('Note', MAX_LENGTHS.note),
  /** A storage path this checkout just uploaded to, not a URL. */
  receipt_path: optionalText('Receipt', 300),
  /** The total the customer was shown. Compared against the server's own
   * pricing, never stored — see lib/commerce/create-order.ts. */
  expected_total: z.coerce.number().finite().nonnegative().nullish(),
  /** The checkout checkbox. Absent on any order placed before this field
   *  existed, so nullish rather than required — treated as false wherever
   *  it's read. */
  whatsapp_opt_in: z.boolean().nullish(),
});

export type CreateOrderBody = z.infer<typeof createOrderSchema>;

