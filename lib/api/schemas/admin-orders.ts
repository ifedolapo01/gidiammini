/**
 * Request schemas for the admin order actions that change money or contents.
 *
 * Everything here reaches either the inventory or the customer's bank balance,
 * so the rule is the same as lib/api/schemas/public-orders.ts: nothing the
 * request did not explicitly name can get through, and every free-text field
 * is length-capped so an unbounded string cannot be pushed into a text column,
 * an email body or a log line.
 *
 * Amounts are deliberately not trusted beyond their shape. The order's total
 * is recomputed by edit_order_items() from the lines below, and a refund is
 * checked against what was actually received — a number in a request body is
 * an assertion, never an authority.
 */
import { z } from 'zod';
import { MAX_LENGTHS, optionalText, requiredText } from './common';
import { CANCELLATION_CODES } from '@/lib/commerce/cancellation-reasons';
import { REFUND_CODES, REFUND_METHODS } from '@/lib/commerce/refund-reasons';

/** Naira. Integer, because every price column in this schema is one. */
const nairaInt = z
  .number({ error: 'Enter an amount in Naira.' })
  .int('Amounts are whole Naira.')
  .min(0, 'An amount cannot be negative.')
  .max(100_000_000, 'That amount is not plausible.');

/**
 * One line of an edited order.
 *
 * product_id is nullable, matching edit_order_items(): a line whose product
 * has since been deleted has to survive an edit, and it does so as money
 * without inventory.
 */
export const orderEditLineSchema = z.object({
  product_id: z.string().uuid('That is not a valid product.').nullish().transform((v) => v ?? null),
  product_name: requiredText('Product name', MAX_LENGTHS.name),
  price: nairaInt,
  quantity: z
    .number({ error: 'Enter a quantity.' })
    .int('Quantity must be a whole number.')
    .min(1, 'Quantity must be at least 1.')
    .max(999, 'Quantity must be 999 or fewer.'),
  size: optionalText('Size', 80).transform((v) => v || null),
  color: optionalText('Colour', 80).transform((v) => v || null),
});

export const orderEditSchema = z.object({
  /** The whole set of lines, not a patch — see editOrderItems(). */
  items: z
    .array(orderEditLineSchema)
    .min(1, 'An order must keep at least one item. Cancel it instead of emptying it.')
    .max(50, 'An order cannot hold more than 50 lines.'),
  /** Omitted leaves any existing discount alone; 0 clears it. */
  discount_amount: nairaInt.nullish(),
  discount_reason: optionalText('Discount reason', MAX_LENGTHS.note),
  /** The admin's own words about the change, sent to the customer. */
  note: optionalText('Note', MAX_LENGTHS.note),
  notify: z.boolean().nullish().transform((v) => v !== false),
});

export type OrderEditBody = z.infer<typeof orderEditSchema>;

/**
 * Cancelling.
 *
 * reason_code is required and comes from the fixed list — that requirement is
 * the entire point of the change. The free-text note stays optional here and
 * is enforced per-ground by the UI (see CancellationReason.requiresNote),
 * because "which grounds need explaining" is an editorial judgement that
 * belongs beside the grounds themselves, not duplicated in a schema.
 */
export const orderCancelSchema = z.object({
  reason_code: z.enum(CANCELLATION_CODES, {
    error: 'Choose why this order is being cancelled.',
  }),
  reason: optionalText('Reason', MAX_LENGTHS.note),
  notify: z.boolean().nullish().transform((v) => v !== false),
});

export type OrderCancelBody = z.infer<typeof orderCancelSchema>;

/**
 * The courier details on an order.
 *
 * Every field is optional: a shop that hands the parcel to its own rider has
 * no waybill, and refusing for want of one would push the whole thing back
 * outside the system — which is the problem, not the fix.
 *
 * No `notify` field. Its only caller is the tracking endpoint, which exists to
 * correct a mistyped waybill and deliberately never re-notifies; the shipping
 * notification is sent by the status transition that first collected these.
 */
export const orderShipmentSchema = z.object({
  carrier: optionalText('Courier', 80),
  tracking_number: optionalText('Tracking number', 80),
  tracking_url: optionalText('Tracking link', 500),
});

export type OrderShipmentBody = z.infer<typeof orderShipmentSchema>;

/** Money going back. `amount` is numeric here, not integer: a partial refund
 * of an odd total genuinely has kobo in it. */
export const refundCreateSchema = z.object({
  amount: z
    .number({ error: 'Enter the amount you are refunding.' })
    .positive('A refund must be more than zero.')
    .max(100_000_000, 'That amount is not plausible.'),
  method: z.enum(REFUND_METHODS).nullish().transform((v) => v ?? 'transfer'),
  reason_code: z.enum(REFUND_CODES, { error: 'Choose why this refund is being issued.' }),
  reference: optionalText('Reference', 120),
  note: optionalText('Note', MAX_LENGTHS.note),
  /** True for money that has already left — a cash refund over the counter. */
  settled: z.boolean().nullish().transform((v) => v === true),
  notify: z.boolean().nullish().transform((v) => v !== false),
});

export type RefundCreateBody = z.infer<typeof refundCreateSchema>;

/** A refund that was agreed either goes out or does not. */
export const refundSettleSchema = z.object({
  outcome: z.enum(['completed', 'failed'], { error: 'Say whether the transfer went out.' }),
  reference: optionalText('Reference', 120),
  note: optionalText('Note', MAX_LENGTHS.note),
  notify: z.boolean().nullish().transform((v) => v !== false),
});

export type RefundSettleBody = z.infer<typeof refundSettleSchema>;
