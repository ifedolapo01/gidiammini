/**
 * COMMERCE layer — the transactional write for a new counter sale.
 *
 * A sibling of persist-order.ts, not a branch inside it: an online order
 * claims stock as a *reservation* and waits for a human (or a webhook) to
 * verify payment before it counts as sold. A counter sale is paid in hand at
 * the moment it is rung up, so there is nothing to reserve or verify — stock
 * is claimed permanently, the order is created already 'picked_up', and its
 * payment is recorded in the same breath.
 *
 * Order of operations, same shape as persistOrderWithReservedStock:
 *   1. claim stock permanently — atomic and all-or-nothing inside Postgres
 *   2. insert order   — on failure, release the claim
 *   3. insert items   — on failure, release the claim and delete the order
 *   4. insert the payment (best-effort: the trigger on order_payments keeps
 *      orders.amount_paid in step, but a failure here does not unwind a sale
 *      that has already changed hands)
 *   5. insert the status-history row (best-effort, same reasoning)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { adjustStock, toStockChangeItems } from './order-stock';
import { generatePaymentReference } from './payment-reference';
import type { CounterSalePriced } from './counter-sale.types';

export interface CounterSaleOrderFields {
  order_number: string;
  idempotency_key: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_id: string | null;
  payment_method: 'cash' | 'pos';
  /** The admin who rang this sale up — attributed on the payment and the
   *  status-history row, same as any other admin-caused change. */
  actor_id: string;
  actor_email: string | null;
}

export type PersistCounterSaleResult =
  | { ok: true; order: { id: string; order_number: string }; joinedExisting?: boolean }
  | { ok: false; error: string; status: number };

export async function persistCounterSale(
  supabase: SupabaseClient,
  fields: CounterSaleOrderFields,
  priced: CounterSalePriced
): Promise<PersistCounterSaleResult> {
  const stockItems = toStockChangeItems(priced.items);

  // 1. Claim the stock — permanently, not as a reservation. There is no
  //    verification step waiting to happen after this: the money is already
  //    in the till.
  const claim = await adjustStock(supabase, stockItems, true, {
    actorId: fields.actor_id,
    saleReason: 'counter_sale',
  });
  if (claim.error) {
    return { ok: false, status: 409, error: claim.error };
  }

  const releaseClaim = async (reason: string) => {
    const release = await adjustStock(supabase, stockItems, false, { actorId: fields.actor_id });
    if (release.error) {
      console.error(
        `CRITICAL: stock claimed for counter sale ${fields.order_number} but not released after ${reason}. ` +
        `Inventory is now understated for: ${stockItems.map((i) => i.product_id).join(', ')}`
      );
    }
  };

  // 2. Insert the order, already complete: paid, handed over, nothing to wait
  //    on. selected_state carries a fixed sentinel rather than a real place —
  //    see OrderPrintDocument.tsx, which knows to suppress it.
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([{
      order_number: fields.order_number,
      idempotency_key: fields.idempotency_key,
      customer_name: fields.customer_name || 'Walk-in customer',
      customer_email: fields.customer_email,
      customer_phone: fields.customer_phone,
      customer_id: fields.customer_id,
      sales_channel: 'counter',
      delivery_option: 'pickup',
      selected_state: 'Counter Sale',
      selected_lga: null,
      selected_place: null,
      shipping_zone_id: null,
      total_amount: priced.total,
      items_subtotal: priced.subtotal,
      tax_amount: priced.tax,
      shipping_amount: priced.shipping,
      payment_method: fields.payment_method,
      payment_reference: generatePaymentReference(fields.order_number),
      status: 'picked_up',
      payment_verified: true,
      stock_reserved: false,
      reserved_until: null,
    }])
    .select()
    .single();

  if (orderError) {
    // 23505 = unique violation. On idempotency_key it means a concurrent
    // double-click already created this same sale — return the winner rather
    // than ring it up twice.
    if (orderError.code === '23505') {
      const { data: winner } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('idempotency_key', fields.idempotency_key)
        .maybeSingle();

      await releaseClaim('a concurrent request for the same sale won');

      if (winner) {
        return { ok: true, order: winner, joinedExisting: true };
      }

      console.error('Unique violation creating counter sale, but no matching order found:', orderError.message);
      return { ok: false, status: 409, error: 'That sale already exists. Please refresh and check the order.' };
    }

    console.error('Error creating counter sale:', orderError);
    await releaseClaim('the order insert failed');
    return { ok: false, status: 500, error: 'We could not save this sale. Please try again.' };
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
      discount_id: item.discount_id,
      base_price: item.base_price,
    }))
  );

  if (itemsError) {
    console.error('Error creating counter sale items, rolling back order:', itemsError);
    await supabase.from('orders').delete().eq('id', order.id);
    await releaseClaim('the order items insert failed');
    return { ok: false, status: 500, error: 'We could not save the items for this sale. Please try again.' };
  }

  // 4. Record the payment. The trigger on order_payments (sync_order_amount_paid)
  //    updates orders.amount_paid from this row — no separate write needed.
  //    Best-effort: the sale has already happened and the stock has already
  //    moved, so a failed bookkeeping insert here must not unwind either.
  const { error: paymentError } = await supabase.from('order_payments').insert({
    order_id: order.id,
    status: 'verified',
    amount: priced.total,
    method: fields.payment_method,
    received_at: new Date().toISOString(),
    note: 'Counter sale',
    actor_id: fields.actor_id,
    actor_email: fields.actor_email,
  });
  if (paymentError) {
    console.error(`Could not record the payment for counter sale ${fields.order_number}:`, paymentError);
  }

  // 5. Seed the status timeline. A counter sale has no earlier 'pending' entry
  //    to build on — it starts, and ends, at 'picked_up'.
  const { error: historyError } = await supabase.from('order_status_history').insert({
    order_id: order.id,
    status: 'picked_up',
    actor_id: fields.actor_id,
    actor_email: fields.actor_email,
  });
  if (historyError) {
    console.error(`Could not record status history for counter sale ${fields.order_number}:`, historyError);
  }

  return { ok: true, order: { id: order.id, order_number: order.order_number } };
}
