/**
 * COMMERCE layer (server only) — creating a return.
 *
 * Eligibility and the item/quantity checks live here rather than in the SQL
 * function (create_return, in 20260909130000_returns.sql) because the error
 * messages belong to a human, and because only one active return is ever
 * allowed per order at a time (mirroring the one-pending-request-per-order
 * rule order_change_requests already enforces) — which means the "has this
 * quantity already been claimed" question only ever has to look at a REFUNDED
 * return on the same order, never a concurrent one: a second return cannot
 * exist to race this check.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { asOrderStatus } from './db-narrowing';
import { canRequestReturn, deliveredAtFrom } from './order-status';

interface OrderItemRow {
  id: string;
  quantity: number;
}

interface ReturnableOrder {
  id: string;
  status: string;
  order_items: OrderItemRow[];
  order_status_history: { status: string; changed_at: string | null }[] | null;
}

export interface CreateReturnParams {
  order: ReturnableOrder;
  reason: string;
  items: Array<{ orderItemId: string; quantity: number }>;
  windowDays: number;
}

export type CreateReturnResult =
  | { ok: true; returnId: string; rmaNumber: string }
  | { ok: false; error: string; status: number };

/** Units of this order item already claimed by a return that actually went
 *  through, keyed by order_item_id. A rejected return claims nothing; a
 *  return still in flight cannot coexist with a new one (see the caller's own
 *  active-return check), so refunded is the only prior state left to guard
 *  against. */
async function refundedQuantities(
  supabase: SupabaseClient,
  orderId: string
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('returns')
    .select('return_items (order_item_id, quantity)')
    .eq('order_id', orderId)
    .eq('status', 'refunded');

  if (error) {
    console.error(`Could not read prior returns for order ${orderId}:`, error.message);
    return new Map();
  }

  const claimed = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ return_items: { order_item_id: string; quantity: number }[] }>) {
    for (const item of row.return_items ?? []) {
      claimed.set(item.order_item_id, (claimed.get(item.order_item_id) ?? 0) + item.quantity);
    }
  }
  return claimed;
}

export async function createReturnRequest(
  supabase: SupabaseClient,
  { order, reason, items, windowDays }: CreateReturnParams
): Promise<CreateReturnResult> {
  const status = asOrderStatus(order.status);
  const deliveredAt = deliveredAtFrom(order.order_status_history);

  if (!canRequestReturn(status, deliveredAt, windowDays)) {
    return {
      ok: false,
      error: `This order is not eligible for a return. It must have been delivered within the last ${windowDays} day${windowDays === 1 ? '' : 's'}.`,
      status: 400,
    };
  }

  if (items.length === 0) {
    return { ok: false, error: 'Choose at least one item to return.', status: 400 };
  }

  const { data: activeReturns, error: activeError } = await supabase
    .from('returns')
    .select('id')
    .eq('order_id', order.id)
    .not('status', 'in', '(rejected,refunded)')
    .limit(1);

  if (activeError) {
    console.error(`Could not check active returns for order ${order.id}:`, activeError.message);
    return { ok: false, error: 'Could not start this return. Please try again.', status: 500 };
  }
  if ((activeReturns ?? []).length > 0) {
    return { ok: false, error: 'A return is already in progress for this order.', status: 400 };
  }

  const orderItems = new Map(order.order_items.map((item) => [item.id, item]));
  const claimed = await refundedQuantities(supabase, order.id);

  for (const line of items) {
    const orderItem = orderItems.get(line.orderItemId);
    if (!orderItem) {
      return { ok: false, error: 'One of those items is not on this order.', status: 400 };
    }

    const already = claimed.get(line.orderItemId) ?? 0;
    const remaining = orderItem.quantity - already;
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > remaining) {
      return {
        ok: false,
        error: remaining <= 0
          ? 'One of those items has already been fully returned.'
          : `You can return at most ${remaining} of one of those items.`,
        status: 400,
      };
    }
  }

  const { data, error } = await supabase.rpc('create_return', {
    p_order_id: order.id,
    p_reason: reason,
    p_items: items.map((line) => ({ order_item_id: line.orderItemId, quantity: line.quantity })),
  });

  if (error || !data) {
    console.error(`Could not create return for order ${order.id}:`, error?.message);
    return { ok: false, error: 'Could not start this return. Please try again.', status: 500 };
  }

  const result = data as { return_id: string; rma_number: string };
  return { ok: true, returnId: result.return_id, rmaNumber: result.rma_number };
}
