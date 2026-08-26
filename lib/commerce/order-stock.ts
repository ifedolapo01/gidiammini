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
 * The bucket-selection rules there deliberately mirror
 * stock-adjustment.ts::adjustVariantStockByDelta, so claim and release remain
 * exact inverses and pricing_config can't drift from products.stock.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

interface OrderItemForStockChange {
  product_id?: string | null;
  size?: string | null;
  color?: string | null;
  quantity: number;
}

interface OrderForStockChange {
  order_items?: OrderItemForStockChange[];
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
  isReserving: boolean
): Promise<{ error?: string }> {
  if (items.length === 0) return {};

  const { error } = await supabase.rpc('adjust_order_stock', {
    p_items: items,
    p_reserve: isReserving,
  });

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

/** Convenience wrapper for callers that already hold a full order row. */
export async function applyOrderStockChange(
  supabase: SupabaseClient,
  order: OrderForStockChange,
  isReserving: boolean
): Promise<{ error?: string }> {
  return adjustStock(supabase, toStockChangeItems(order.order_items), isReserving);
}
