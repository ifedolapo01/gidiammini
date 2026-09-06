/**
 * The one bulk action that moves inventory.
 *
 * Split from bulk-actions.ts because it does two things none of the others do:
 * it writes through the inventory ledger (so the movement is attributed to the
 * person who ran the batch) and it can send mail to everyone waiting on a
 * restock. Both are consequences that outlive the request, which is a
 * different kind of handler from "set this product inactive".
 *
 * Same contract as the rest: one row in, one BulkRowOutcome out, batching and
 * concurrency in lib/api/bulk.ts.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuditRecorder } from '@/lib/api/with-admin-auth';
import { notifyIfRestocked } from '@/lib/commerce/stock-alerts';
import type { BulkRowOutcome } from './bulk-actions';

/**
 * Sets one variant's stock. `rowId` is "productId:variantKey" — the stock table
 * addresses variants, not products, and a variant key can itself contain a
 * colon-free "size|color", so only the first colon separates the two.
 */
export async function setVariantStock(
  supabase: SupabaseClient,
  rowId: string,
  stock: number,
  names: Map<string, string>,
  audit: AuditRecorder,
  actorId: string | null = null
): Promise<BulkRowOutcome> {
  const separator = rowId.indexOf(':');
  if (separator < 1) return { ok: false, label: rowId, error: 'Malformed variant reference' };

  const productId = rowId.slice(0, separator);
  const variantKey = rowId.slice(separator + 1);
  const label = `${names.get(productId) ?? productId} · ${variantKey}`;

  const { data: previousProduct } = await supabase
    .from('products')
    .select('stock')
    .eq('id', productId)
    .maybeSingle();

  const { data, error } = await supabase.rpc('set_variant_stock', {
    p_product_id: productId,
    p_variant_key: variantKey,
    p_new_stock: stock,
    // A bulk set is a correction by definition — it writes the same absolute
    // number across a selection, which is not what a delivery looks like. A
    // restock reaches a variant at a time.
    p_reason: 'adjustment',
    p_note: 'Bulk stock set',
    p_actor_id: actorId,
  });

  if (error) return { ok: false, label, error: error.message };

  audit({
    entityType: 'product_variant',
    entityId: `${productId}:${variantKey}`,
    action: 'stock_change',
    after: { stock },
    reason: 'Bulk stock set',
  });

  // Same best-effort restock alert the single-variant save sends — a bulk
  // restock is exactly when the people waiting on a product should hear.
  const result = (data ?? {}) as { stock?: number };
  await notifyIfRestocked(
    supabase,
    productId,
    previousProduct?.stock ?? undefined,
    result.stock ?? 0,
    variantKey === 'single' ? null : variantKey
  );

  return { ok: true, label };
}
