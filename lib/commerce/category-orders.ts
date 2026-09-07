/**
 * COMMERCE layer — which orders carry a line in a given product category.
 *
 * The dashboard's "revenue by category" drill-through. Category lives on the
 * product, not the order, so (unlike ?zone, which is a column on orders
 * itself) admin-orders-query.ts has to pre-resolve a set of order ids through
 * a join before it can filter — the same shape findOverdueOrders() already
 * uses for the "Overdue" status filter: narrow to candidates first, then
 * `.in('id', ids)` on the main query.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { UNCATEGORISED } from './revenue-breakdown';

export async function resolveCategoryOrderIds(supabase: SupabaseClient, category: string): Promise<string[]> {
  let query = supabase.from('order_items').select('order_id, products!inner(category)');

  query =
    category === UNCATEGORISED
      // Matches the fallback in revenueByCategory(): a product with no
      // category recorded, or an empty one, both count as "Uncategorised".
      ? query.or('category.is.null,category.eq.', { foreignTable: 'products' })
      : query.eq('products.category', category);

  const { data, error } = await query;
  if (error) {
    console.error('Error resolving orders by category:', error);
    return [];
  }

  return [...new Set((data ?? []).map((row: any) => row.order_id as string))];
}
