/**
 * COMMERCE layer — the transactional write for a new customer order.
 *
 * Claims inventory *before* the order row exists, so an order is never created
 * that the store can't fulfil, and unwinds every step it completed if a later
 * one fails. Supabase's JS client can't open a transaction across statements,
 * so the unwind is explicit rather than a ROLLBACK.
 *
 * Order of operations matters:
 *   1. claim stock   — atomic and all-or-nothing inside Postgres
 *   2. insert order  — on failure, release the claim
 *   3. insert items  — on failure, release the claim and delete the order
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { adjustStock, toStockChangeItems } from './order-stock';
import { INITIAL_ORDER_STATUS } from './order-status';
import type { PricedOrder } from './price-order.types';

/**
 * How long a paid-but-unverified order may hold stock before the sweep
 * (app/api/cron/stock-reservations) releases it. Generous by default: an order
 * only exists here once a receipt has been uploaded, so the customer has
 * already sent money and the reservation is legitimate while an admin works
 * through verification. This is a backstop for orders that are never verified
 * at all, not a checkout timer.
 */
export const RESERVATION_HOURS = Number(process.env.STOCK_RESERVATION_HOURS) || 24 * 7;

export interface OrderRowFields {
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: string | null;
  city: string | null;
  note: string | null;
  receipt_path: string | null;
}

export type PersistOrderResult =
  | { ok: true; order: { id: string; order_number: string } }
  | { ok: false; error: string; status: number };

export async function persistOrderWithReservedStock(
  supabase: SupabaseClient,
  fields: OrderRowFields,
  priced: PricedOrder
): Promise<PersistOrderResult> {
  const stockItems = toStockChangeItems(priced.items);

  // 1. Claim the stock. This is the whole point of the exercise: from here the
  //    units are off the shelf, so a second checkout for the last one fails
  //    rather than succeeding and being sorted out by refund later.
  const claim = await adjustStock(supabase, stockItems, true);
  if (claim.error) {
    return { ok: false, status: 409, error: claim.error };
  }

  /** Puts the claimed units back. Logged loudly on failure — at that point
   * stock is understated and only a human can reconcile it. */
  const releaseClaim = async (reason: string) => {
    const release = await adjustStock(supabase, stockItems, false);
    if (release.error) {
      console.error(
        `CRITICAL: stock claimed for ${fields.order_number} but not released after ${reason}. ` +
        `Inventory is now understated for: ${stockItems.map((i) => i.product_id).join(', ')}`
      );
    }
  };

  const reservedUntil = new Date(Date.now() + RESERVATION_HOURS * 60 * 60 * 1000).toISOString();

  // 2. Insert the order.
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([{
      ...fields,
      total_amount: priced.total,
      delivery_option: priced.delivery_option,
      selected_state: priced.selected_state,
      selected_lga: priced.selected_lga,
      selected_place: priced.selected_place,
      shipping_zone_id: priced.shipping_zone_id,
      status: INITIAL_ORDER_STATUS,
      payment_verified: false,
      stock_reserved: true,
      reserved_until: reservedUntil,
    }])
    .select()
    .single();

  if (orderError) {
    console.error('Error creating order:', orderError);
    await releaseClaim('the order insert failed');
    return { ok: false, status: 500, error: 'We could not save your order. Please try again.' };
  }

  // 3. Insert the line items.
  const { error: itemsError } = await supabase.from('order_items').insert(
    priced.items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      price: item.price,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
    }))
  );

  if (itemsError) {
    // An order row without items is unfulfillable and its total reconciles
    // against nothing, so unwind fully rather than leave a half-order.
    console.error('Error creating order items, rolling back order:', itemsError);
    await supabase.from('orders').delete().eq('id', order.id);
    await releaseClaim('the order items insert failed');
    return { ok: false, status: 500, error: 'We could not save your order items. Please try again.' };
  }

  return { ok: true, order: { id: order.id, order_number: order.order_number } };
}
