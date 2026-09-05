/**
 * COMMERCE layer — the orders export, flattened one row per line item.
 *
 * That is the shape a spreadsheet can pivot: order-level fields repeat down the
 * lines of an order, and the order total repeats with them — summing that
 * column across all rows would double-count, so sum `line_total` instead. The
 * column is named `order_total_repeated` to say so on the face of the file.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows, type PagedResult } from './export-paging';
import { text, type DatasetResult, type ExportRange } from './export-types';

/** One line item, with its order's details alongside it. */
interface OrderExportRow {
  order: any;
  item: any;
}

const ORDER_SELECT =
  'order_number, created_at, updated_at, status, payment_verified, payment_method,' +
  ' payment_channel, paid_at, customer_name, customer_email, customer_phone,' +
  ' delivery_option, selected_state, selected_lga, selected_place, city,' +
  ' delivery_address, note, total_amount,' +
  ' order_items ( product_name, size, color, quantity, price )';

export async function ordersDataset(
  supabase: SupabaseClient,
  range: ExportRange
): Promise<DatasetResult<OrderExportRow>> {
  const paged: PagedResult<any> = await fetchAllRows(async (from, to) => {
    let query = supabase
      .from('orders')
      .select(ORDER_SELECT)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (range.from) query = query.gte('created_at', range.from);
    if (range.to) query = query.lte('created_at', range.to);

    return query;
  });

  // An order with no line items still belongs in the file — a missing order is
  // a hole in a reconciliation, and a blank item row says plainly that it has
  // none.
  const rows: OrderExportRow[] = paged.rows.flatMap((order) => {
    const items = order.order_items ?? [];
    return items.length > 0
      ? items.map((item: any) => ({ order, item }))
      : [{ order, item: null }];
  });

  return {
    rows,
    truncated: paged.truncated,
    columns: [
      { header: 'order_number', value: (r) => text(r.order.order_number) },
      { header: 'created_at', value: (r) => text(r.order.created_at) },
      { header: 'status', value: (r) => text(r.order.status) },
      { header: 'payment_verified', value: (r) => r.order.payment_verified === true },
      { header: 'payment_method', value: (r) => text(r.order.payment_method) },
      { header: 'payment_channel', value: (r) => text(r.order.payment_channel) },
      { header: 'paid_at', value: (r) => text(r.order.paid_at) },
      { header: 'customer_name', value: (r) => text(r.order.customer_name) },
      { header: 'customer_email', value: (r) => text(r.order.customer_email) },
      { header: 'customer_phone', value: (r) => text(r.order.customer_phone) },
      { header: 'delivery_option', value: (r) => text(r.order.delivery_option) },
      { header: 'state', value: (r) => text(r.order.selected_state) },
      { header: 'lga', value: (r) => text(r.order.selected_lga) },
      { header: 'place', value: (r) => text(r.order.selected_place) },
      { header: 'city', value: (r) => text(r.order.city) },
      { header: 'delivery_address', value: (r) => text(r.order.delivery_address) },
      { header: 'customer_note', value: (r) => text(r.order.note) },
      { header: 'item_product_name', value: (r) => text(r.item?.product_name) },
      { header: 'item_size', value: (r) => text(r.item?.size) },
      { header: 'item_color', value: (r) => text(r.item?.color) },
      { header: 'item_quantity', value: (r) => (r.item ? Number(r.item.quantity) || 0 : '') },
      { header: 'item_unit_price', value: (r) => (r.item ? Number(r.item.price) || 0 : '') },
      {
        header: 'line_total',
        value: (r) => (r.item ? (Number(r.item.price) || 0) * (Number(r.item.quantity) || 0) : ''),
      },
      // Repeats down every line of the same order — see the note at the top.
      { header: 'order_total_repeated', value: (r) => Number(r.order.total_amount) || 0 },
    ],
  };
}

