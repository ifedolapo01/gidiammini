/**
 * COMMERCE layer — the admin products and stock lists, read one page at a
 * time.
 *
 * Both pages render the same rows grouped the same way (a product, then its
 * variants) and differ only in which columns they show and how they sort, so
 * they share one query. Paging is by *product*, not by variant: a product's
 * variants must stay together on one page or the grouped table renders orphan
 * child rows.
 *
 * The stock filters go through `product_variants!inner`, which both restricts
 * the products returned to those with a matching variant and narrows the
 * embedded variants to the matching ones — so "Low stock" shows the low
 * variants rather than every variant of a product that happens to have one.
 * Products predating the product_variants migration have no variant rows and
 * therefore do not appear under a stock filter; they appear normally without
 * one.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseListParams, listMeta, ilikeAcross, type ListMeta } from '@/lib/api/list-params';

export const ADMIN_PRODUCT_SORTABLE = ['created_at', 'name', 'price', 'stock'] as const;

const SEARCH_COLUMNS = ['name'] as const;

const PRODUCT_COLUMNS =
  'id, name, category, sub_category, price, stock, is_active, main_image, images, pricing_config, created_at, updated_at';

const VARIANT_COLUMNS = 'id, product_id, size, color, variant_key, price, stock, image_url, is_active, sku, cost';

export type StockFilter = 'all' | 'low' | 'out' | 'in';

export interface AdminProductsPage {
  products: any[];
  meta: ListMeta;
}

export interface AdminProductsQueryOptions {
  defaultSort?: (typeof ADMIN_PRODUCT_SORTABLE)[number];
  defaultDirection?: 'asc' | 'desc';
}

function readStockFilter(value: string | null): StockFilter {
  return value === 'low' || value === 'out' || value === 'in' ? value : 'all';
}

function readLowStockThreshold(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 1000) : 5;
}

export async function fetchAdminProducts(
  supabase: SupabaseClient,
  url: URL,
  options: AdminProductsQueryOptions = {}
): Promise<AdminProductsPage> {
  const params = parseListParams(url, {
    sortable: ADMIN_PRODUCT_SORTABLE,
    defaultSort: options.defaultSort ?? 'created_at',
    defaultDirection: options.defaultDirection ?? 'desc',
  });

  const stockFilter = readStockFilter(url.searchParams.get('stock'));
  const threshold = readLowStockThreshold(url.searchParams.get('lowStockThreshold'));
  const status = url.searchParams.get('status');
  const category = url.searchParams.get('category');
  const subCategory = url.searchParams.get('subCategory');

  // `!inner` only when a stock filter is actually applied — an inner join would
  // otherwise silently drop every product that has no variant rows yet.
  const variantJoin = stockFilter === 'all' ? 'product_variants' : 'product_variants!inner';

  let query = supabase
    .from('products')
    .select(`${PRODUCT_COLUMNS}, ${variantJoin} ( ${VARIANT_COLUMNS} )`, { count: 'exact' })
    .order(params.sort, { ascending: params.ascending })
    // Stable tiebreaker, so rows cannot swap between pages when two products
    // share a sort value (very common on `stock`).
    .order('id', { ascending: true })
    .range(params.from, params.to);

  // Deletion is soft, so the default view is active products only — the same
  // set the list has always shown. 'all' and 'inactive' exist so a bulk
  // reactivate is reachable at all.
  if (status === 'inactive') {
    query = query.eq('is_active', false);
  } else if (status !== 'all') {
    query = query.eq('is_active', true);
  }

  if (category) query = query.eq('category', category);
  if (subCategory) query = query.eq('sub_category', subCategory);

  if (stockFilter === 'out') {
    query = query.lte('product_variants.stock', 0);
  } else if (stockFilter === 'low') {
    query = query.gt('product_variants.stock', 0).lte('product_variants.stock', threshold);
  } else if (stockFilter === 'in') {
    query = query.gt('product_variants.stock', threshold);
  }

  if (params.search) {
    query = query.or(ilikeAcross(SEARCH_COLUMNS, params.search));
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return { products: data ?? [], meta: listMeta(params, count ?? 0) };
}
