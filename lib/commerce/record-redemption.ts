/**
 * COMMERCE layer (server only) — writing down that a code was used.
 *
 * Split from persist-order.ts, whose job is making the order exist. This is a
 * reporting row, and the difference matters in how it fails: persisting the
 * order is allowed to abort the checkout, and this is not.
 *
 * NEVER FATAL
 *
 * By the time this runs the order exists and the customer has been charged.
 * Failing the request because a statistic would not insert would cost the shop
 * a sale to save a number. What a failure costs instead is one uncounted
 * redemption — which the UNIQUE (discount_id, order_id) makes safe to insert
 * again later if anybody reconciles, and which is logged loudly enough to be
 * found.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PricedOrder } from './price-order.types';

export interface RedemptionContext {
  priced: PricedOrder;
  orderId: string;
  /** For the log line, which somebody reads before they have the id to hand. */
  orderNumber: string;
  customerId: string | null;
  customerEmail: string;
}

export async function recordDiscountRedemption(
  supabase: SupabaseClient,
  { priced, orderId, orderNumber, customerId, customerEmail }: RedemptionContext
): Promise<void> {
  const applied = priced.applied_code;
  if (!applied) return;

  const { error } = await supabase.from('discount_redemptions').insert({
    discount_id: applied.discount_id,
    order_id: orderId,
    customer_id: customerId,
    // Lower-cased, because the per-customer limit is counted on this and a
    // customer who capitalises their address differently on a second order is
    // the same person.
    email: (customerEmail ?? '').trim().toLowerCase(),
    amount_saved: applied.saved_on_items + applied.saved_on_shipping,
  });

  if (error) {
    console.error(
      `Order ${orderNumber} used code ${applied.code} but the redemption was not ` +
      `recorded. Redemption counts and the code's limits will under-count until ` +
      `this is reconciled.`,
      error
    );
  }
}
