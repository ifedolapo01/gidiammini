/**
 * COMMERCE layer — the counts above the admin products and stock lists, and
 * the change token those pages poll on.
 *
 * Once the lists are paged the browser no longer holds every product, so the
 * summary cards ("3 low stock", "2 out of stock") have to be counted in the
 * database. Every figure here is a `head: true` count — PostgREST returns the
 * number in a header and no rows at all.
 *
 * The variant counts join back to products so a variant belonging to a
 * soft-deleted product is not counted as sellable stock.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdminProductsSummary {
  /** Active products. */
  products: number;
  /** Sellable variants across those products — the stock table's row count. */
  variants: number;
  lowStock: number;
  outOfStock: number;
  lowStockThreshold: number;
}

/**
 * products.updated_at alone is not enough: a stock change writes
 * product_variants and the trigger recomputes products.stock without touching
 * products.updated_at, so a stock edit made in another tab would go unnoticed.
 * Both tables' high-water marks go into the token.
 */
export async function fetchProductsChangeCursor(supabase: SupabaseClient): Promise<string> {
  const [{ count }, { data: productRow }, { data: variantRow }] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('updated_at').order('updated_at', { ascending: false }).limit(1),
    supabase.from('product_variants').select('updated_at').order('updated_at', { ascending: false }).limit(1),
  ]);

  return `${count ?? 0}:${productRow?.[0]?.updated_at ?? ''}:${variantRow?.[0]?.updated_at ?? ''}`;
}

export async function fetchAdminProductsSummary(
  supabase: SupabaseClient,
  lowStockThreshold: number
): Promise<AdminProductsSummary> {
  const activeVariants = () =>
    supabase
      .from('product_variants')
      .select('id, products!inner(is_active)', { count: 'exact', head: true })
      .eq('products.is_active', true);

  const [{ count: products }, { count: variants }, { count: lowStock }, { count: outOfStock }] =
    await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
      activeVariants(),
      activeVariants().gt('stock', 0).lte('stock', lowStockThreshold),
      activeVariants().lte('stock', 0),
    ]);

  return {
    products: products ?? 0,
    variants: variants ?? 0,
    lowStock: lowStock ?? 0,
    outOfStock: outOfStock ?? 0,
    lowStockThreshold,
  };
}
