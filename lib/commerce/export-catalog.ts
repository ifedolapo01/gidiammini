/**
 * COMMERCE layer — the catalogue and customer exports.
 *
 * Products and stock are the same rows with different columns, so they share
 * one query; flattenProducts already produces exactly the one-row-per-variant
 * shape both want, and the same shape the CSV importer reads back.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { flattenProducts, variantRef, type FlattenedProduct } from './product-flatten';
import { fetchAllRows, type PagedResult } from './export-paging';
import { text, type DatasetResult } from './export-types';

const CATALOGUE_SELECT =
  'id, name, category, sub_category, price, stock, is_active, main_image, images,' +
  ' pricing_config, product_variants ( id, product_id, size, color, variant_key,' +
  ' price, stock, sku, cost, image_url, is_active )';

/** Every variant of every product, which is the row shape both catalogue
 * exports want — flattenProducts already produces exactly it. */
async function variantRows(supabase: SupabaseClient): Promise<PagedResult<FlattenedProduct>> {
  const paged = await fetchAllRows<any>(async (from, to) =>
    supabase
      .from('products')
      .select(CATALOGUE_SELECT)
      .order('name', { ascending: true })
      .range(from, to)
  );

  return { rows: flattenProducts(paged.rows), truncated: paged.truncated };
}

export async function productsDataset(supabase: SupabaseClient): Promise<DatasetResult<FlattenedProduct>> {
  const { rows, truncated } = await variantRows(supabase);

  return {
    rows,
    truncated,
    columns: [
      { header: 'product_id', value: (r) => r.productId },
      { header: 'name', value: (r) => r.name },
      { header: 'category', value: (r) => text(r.category) },
      { header: 'sub_category', value: (r) => text(r.sub_category) },
      { header: 'variant_key', value: (r) => r.variantKey },
      { header: 'size', value: (r) => text(r.size) },
      { header: 'color', value: (r) => text(r.color) },
      { header: 'sku', value: (r) => text(r.sku) },
      { header: 'price', value: (r) => r.price },
      { header: 'cost', value: (r) => (typeof r.cost === 'number' ? r.cost : '') },
      { header: 'stock', value: (r) => r.stock },
      { header: 'variant_active', value: (r) => r.isActive !== false },
      { header: 'main_image', value: (r) => text(r.main_image) },
    ],
  };
}

export async function stockDataset(supabase: SupabaseClient): Promise<DatasetResult<FlattenedProduct>> {
  const { rows, truncated } = await variantRows(supabase);

  return {
    rows,
    truncated,
    columns: [
      // The same reference the bulk stock endpoint accepts, so an exported
      // sheet can be counted against and fed back in.
      { header: 'variant_ref', value: (r) => variantRef(r) },
      { header: 'name', value: (r) => r.name },
      { header: 'variant', value: (r) => r.variantLabel },
      { header: 'sku', value: (r) => text(r.sku) },
      { header: 'stock', value: (r) => r.stock },
      { header: 'price', value: (r) => r.price },
    ],
  };
}

export async function customersDataset(supabase: SupabaseClient): Promise<DatasetResult<any>> {
  // The view already carries the aggregates an owner would otherwise rebuild
  // in the spreadsheet by hand.
  const paged = await fetchAllRows<any>(async (from, to) =>
    supabase
      .from('customer_stats')
      .select('*')
      .order('lifetime_value', { ascending: false })
      .range(from, to)
  );

  return {
    rows: paged.rows,
    truncated: paged.truncated,
    columns: [
      { header: 'full_name', value: (r) => text(r.full_name) },
      { header: 'email', value: (r) => text(r.email) },
      { header: 'phone', value: (r) => text(r.phone_e164) },
      { header: 'orders_total', value: (r) => Number(r.orders_total) || 0 },
      { header: 'orders_cancelled', value: (r) => Number(r.orders_cancelled) || 0 },
      { header: 'orders_revenue', value: (r) => Number(r.orders_revenue) || 0 },
      { header: 'lifetime_value', value: (r) => Number(r.lifetime_value) || 0 },
      { header: 'first_order_at', value: (r) => text(r.first_order_at) },
      { header: 'last_order_at', value: (r) => text(r.last_order_at) },
      { header: 'is_blocked', value: (r) => r.is_blocked === true },
    ],
  };
}

