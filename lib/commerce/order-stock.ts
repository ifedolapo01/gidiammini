/** COMMERCE layer — claims or releases an order's stock.
 *
 * Delegates to the adjust_order_stock() Postgres function
 * (scripts/add-stock-reservation.sql) rather than doing the arithmetic here.
 * That matters for two reasons:
 *
 *  - Atomicity. This previously read every product, computed new values in JS,
 *    then issued one UPDATE per product. Two admins confirming at once, or a
 *    confirm racing a stock edit, silently lost a write. The function locks
 *    every product row before touching any of them, so concurrent callers
 *    serialise instead.
 *  - All-or-nothing. A shortage part-way through a multi-item order used to
 *    leave the earlier items already decremented. The function raises, so
 *    Postgres rolls back the whole adjustment.
 *
 * Claiming and releasing are exact inverses inside that one function, so
 * pricing_config can't drift from products.stock. The JS mirror of this
 * arithmetic (stock-adjustment.ts) was deleted once the SQL became
 * authoritative — two copies with nothing comparing them would have drifted
 * apart while both looked correct.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

interface OrderItemForStockChange {
  product_id?: string | null;
  size?: string | null;
  color?: string | null;
  quantity: number;
}

interface OrderForStockChange {
  id?: string | null;
  order_items?: OrderItemForStockChange[];
}

/** Who and what to attribute the movement to in inventory_movements.
 *
 * Optional throughout: the reservation sweep has no actor and edit_order_items
 * calls the function inline with neither. A movement with no reference is still
 * a movement, and recording it unattributed is better than not recording it. */
export interface StockChangeContext {
  /** orders.id, so the ledger can answer "what did this order do to stock". */
  orderId?: string | null;
  /** auth.users.id of the admin who caused it, where one did. */
  actorId?: string | null;
}

/** Raised by adjust_order_stock() when a claim would oversell. Its message is
 * already customer-facing (e.g. "Only 2 left of Cotton Gown (0-3m / red)."). */
const OVERSELL_SQLSTATE = 'GM001';

/** Postgres/PostgREST codes for "that function isn't there" — almost always
 * means scripts/add-stock-reservation.sql hasn't been run against this database. */
const MISSING_FUNCTION_CODES = ['42883', 'PGRST202'];

export interface StockChangeItem {
  product_id: string;
  size: string | null;
  color: string | null;
  quantity: number;
}

/** Normalises order items into the shape adjust_order_stock() expects. */
export function toStockChangeItems(items: OrderItemForStockChange[] = []): StockChangeItem[] {
  return items
    .filter((item) => !!item.product_id)
    .map((item) => ({
      product_id: item.product_id as string,
      size: item.size ?? null,
      color: item.color ?? null,
      quantity: item.quantity,
    }));
}

/**
 * `isReserving` true = claim stock (an order is taking inventory); false =
 * release it (a reserved order was cancelled or swept).
 */
export async function adjustStock(
  supabase: SupabaseClient,
  items: StockChangeItem[],
  isReserving: boolean,
  context: StockChangeContext = {}
): Promise<{ error?: string }> {
  if (items.length === 0) return {};

  // The function labels the movement 'sale' or 'release' from p_reserve on its
  // own — these two only say which order and which person to attribute it to.
  let { error } = await supabase.rpc('adjust_order_stock', {
    p_items: items,
    p_reserve: isReserving,
    p_reference_id: context.orderId ?? null,
    p_actor_id: context.actorId ?? null,
  });

  // Retried without the ledger arguments, for the window between deploying
  // this code and applying 20260906120000_inventory_movements.sql — which
  // widened this function's signature, so PostgREST answers PGRST202 until it
  // has run. Losing the attribution on a movement costs a line in a report;
  // losing this call costs every checkout, because stock could not be claimed.
  // Deliberately not applied to a genuine oversell (GM001), which must fail.
  if (error && MISSING_FUNCTION_CODES.includes(error.code ?? '')) {
    console.error(
      'adjust_order_stock() did not accept the ledger arguments — apply ' +
      '20260906120000_inventory_movements.sql. Retrying without them.'
    );
    ({ error } = await supabase.rpc('adjust_order_stock', {
      p_items: items,
      p_reserve: isReserving,
    } as any));
  }

  if (!error) return {};

  if (error.code === OVERSELL_SQLSTATE) {
    return { error: error.message };
  }

  if (MISSING_FUNCTION_CODES.includes(error.code ?? '')) {
    console.error(
      'adjust_order_stock() is missing — run scripts/add-stock-reservation.sql against this database.'
    );
    return { error: 'Inventory is not configured on the server. Please contact support.' };
  }

  console.error('Stock adjustment failed:', error);
  return {
    error: isReserving
      ? 'We could not hold stock for this order. Please try again.'
      : 'We could not return stock for this order. Please try again.',
  };
}

/** Convenience wrapper for callers that already hold a full order row. Takes
 *  the order's own id as the ledger reference, so a status transition does not
 *  have to be told what it is working on twice. */
export async function applyOrderStockChange(
  supabase: SupabaseClient,
  order: OrderForStockChange,
  isReserving: boolean,
  context: Omit<StockChangeContext, 'orderId'> = {}
): Promise<{ error?: string }> {
  return adjustStock(supabase, toStockChangeItems(order.order_items), isReserving, {
    ...context,
    orderId: order.id ?? null,
  });
}
