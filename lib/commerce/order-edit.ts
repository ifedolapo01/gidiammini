/**
 * COMMERCE layer (server only) — changing what an order contains.
 *
 * The one place an order's lines are rewritten. Everything that has to happen
 * together — the stock difference, the replaced rows, the recomputed total —
 * happens inside edit_order_items() in Postgres, so this module's job is the
 * three things SQL is the wrong place for:
 *
 *   1. Reading what the order looked like before, so the change can be
 *      described rather than merely applied. "Total went from 24,500 to
 *      31,000" is not an answer to "what did you change".
 *   2. Mapping the function's error codes to something an operator can read.
 *      GM001 already carries a customer-grade sentence ("Only 2 left of Cotton
 *      Gown"); GM003 carries the validation message; anything else is a bug
 *      and says so.
 *   3. Telling the customer. An order edited silently is how a shop delivers
 *      something the buyer never agreed to.
 *
 * Nothing here decides prices. The caller supplies a price per line — because
 * a swap at an agreed price and a goodwill adjustment are both legitimate and
 * neither can be derived from the catalogue — and the *total* is then computed
 * from those lines by the database, never by the browser.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadPublicStoreSettings } from './store-settings-server';
import { diffOrderLines, describeLineChange, type LineChange, type OrderLine } from './order-edit-diff';
import { sendOrderAmendedNotice } from '@/lib/notifications';

const ORDER_COLUMNS =
  'id, order_number, customer_name, customer_email, status, total_amount, amount_paid,' +
  ' items_subtotal, tax_amount, shipping_amount, discount_amount, discount_reason';

/** Raised by edit_order_items() for anything the caller got wrong. */
const INVALID_SQLSTATE = 'GM003';
/** Raised by adjust_order_stock() when the new lines cannot be stocked. */
const OVERSELL_SQLSTATE = 'GM001';
/** Postgres/PostgREST codes for "that function isn't there". */
const MISSING_FUNCTION_CODES = ['42883', 'PGRST202'];

export interface OrderEditTotals {
  items_subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  discount_reason: string | null;
  total_amount: number;
  previous_total: number;
  stock_adjusted: boolean;
}

export interface EditOrderInput {
  orderId: string;
  /** The order's lines as they should now stand — the whole set, not a patch. */
  items: OrderLine[];
  /** Manual reduction in Naira. Undefined leaves the existing one alone; 0 clears it. */
  discountAmount?: number;
  discountReason?: string | null;
  /** Email the customer about the change. Default true — see the header. */
  notify?: boolean;
  /** The admin's own words, added to that email and kept on the audit entry. */
  note?: string | null;
}

export type EditOrderResult =
  | {
      ok: true;
      totals: OrderEditTotals;
      changes: LineChange[];
      /** One sentence per change, for the audit entry and the toast. */
      summary: string[];
      /** True when the customer was actually emailed. */
      notified: boolean;
    }
  | { ok: false; error: string; status: number };

/** Turns a PostgrestError from the RPC into something worth showing. */
function describeRpcError(error: { code?: string; message?: string }): { error: string; status: number } {
  if (error.code === OVERSELL_SQLSTATE) {
    // Already phrased for a human by adjust_order_stock().
    return { error: error.message ?? 'There is not enough stock for these items.', status: 409 };
  }

  if (error.code === INVALID_SQLSTATE) {
    return { error: error.message ?? 'That edit is not valid.', status: 400 };
  }

  if (MISSING_FUNCTION_CODES.includes(error.code ?? '')) {
    console.error(
      'edit_order_items() is missing — run the 20260905190100 migration against this database.'
    );
    return { error: 'Order editing is not configured on the server.', status: 500 };
  }

  console.error('Order edit failed:', error);
  return { error: 'We could not save this edit. Nothing was changed.', status: 500 };
}

/**
 * Deliberately takes no actor.
 *
 * An edit does not move the order's status, so there is no order_status_history
 * row for it to sign, and the record of who did it is the audit entry the route
 * writes. Accepting an actor here would be a parameter that goes nowhere and
 * quietly implies the edit is attributed somewhere it is not.
 */
export async function editOrderItems(
  supabase: SupabaseClient,
  input: EditOrderInput
): Promise<EditOrderResult> {
  const { data: before, error: readError } = await supabase
    .from('orders')
    .select(`${ORDER_COLUMNS}, order_items (product_id, product_name, price, quantity, size, color)`)
    .eq('id', input.orderId)
    .maybeSingle();

  if (readError || !before) {
    return { ok: false, error: 'Order not found', status: 404 };
  }

  const order = before as any;
  const previousLines: OrderLine[] = order.order_items ?? [];

  const { data, error } = await supabase.rpc('edit_order_items', {
    p_order_id: input.orderId,
    p_items: input.items.map((line) => ({
      product_id: line.product_id ?? null,
      product_name: line.product_name,
      price: line.price,
      quantity: line.quantity,
      size: line.size ?? null,
      color: line.color ?? null,
    })),
    // The rate the shop is charging now, not the one it was charging when
    // this file was written. An order edited after a VAT change has to be
    // re-taxed at the rate that applies to the edit, which is the same rate
    // the checkout is quoting — both read this row.
    p_tax_rate: (await loadPublicStoreSettings()).taxRate,
    // undefined and null mean different things to the function — null leaves
    // the discount alone — so the distinction is preserved rather than
    // collapsed by JSON serialisation.
    p_discount: input.discountAmount ?? null,
    p_discount_reason: input.discountReason ?? null,
  });

  if (error) {
    return { ok: false, ...describeRpcError(error) };
  }

  const totals = data as unknown as OrderEditTotals;
  const changes = diffOrderLines(previousLines, input.items);
  const summary = changes.map(describeLineChange);

  // A discount that moved is a change the customer must be told about even
  // when every line stayed put, so it earns its own line in the summary.
  if (totals.discount_amount !== order.discount_amount) {
    summary.push(
      totals.discount_amount > 0
        ? `Discount applied: ${totals.discount_amount}`
        : 'Discount removed'
    );
  }

  let notified = false;

  if (input.notify !== false) {
    const sent = await sendOrderAmendedNotice({
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      changes: summary,
      itemsSubtotal: totals.items_subtotal,
      taxAmount: totals.tax_amount,
      shippingAmount: totals.shipping_amount,
      discountAmount: totals.discount_amount,
      discountReason: totals.discount_reason,
      totalAmount: totals.total_amount,
      previousTotal: totals.previous_total,
      amountPaid: Number(order.amount_paid ?? 0),
      note: input.note ?? null,
    });

    notified = sent.success;
    if (!sent.success) {
      // The edit stands either way — it is already committed — but the
      // operator needs to know the customer does not know.
      console.error(`Order ${order.order_number} edited but not emailed: ${sent.detail}`);
    }
  }

  return { ok: true, totals, changes, summary, notified };
}
