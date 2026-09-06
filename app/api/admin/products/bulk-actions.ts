/**
 * What each bulk product action does, as opposed to how it is routed.
 *
 * Every handler here operates on ONE row and reports its own outcome — the
 * batching, the concurrency and the per-row result collection all live in
 * lib/api/bulk.ts. Keeping them single-row is what makes partial failure
 * reportable: a product that cannot be re-priced does not stop the other 59.
 *
 * Where an equivalent single-row endpoint already exists, these go through the
 * same machinery it does (set_variant_stock, sync_variants_from_pricing_config)
 * rather than writing the tables directly. A second, weaker write path for the
 * same data is how prices and stock drift apart.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuditRecorder } from '@/lib/api/with-admin-auth';
import { adjustPricing, describePercent } from '@/lib/commerce/price-adjust';
import { syncVariants } from './product-write';

export interface BulkRowOutcome {
  ok: boolean;
  label?: string;
  error?: string;
}

/** Names for the result list, looked up once for the whole batch. */
export async function productNames(
  supabase: SupabaseClient,
  productIds: string[]
): Promise<Map<string, string>> {
  const { data } = await supabase.from('products').select('id, name').in('id', productIds);
  return new Map<string, string>((data ?? []).map((row: any) => [row.id, row.name]));
}

export async function setProductActive(
  supabase: SupabaseClient,
  id: string,
  isActive: boolean,
  label: string,
  audit: AuditRecorder
): Promise<BulkRowOutcome> {
  const { error } = await supabase
    .from('products')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { ok: false, label, error: error.message };

  audit({
    entityType: 'product',
    entityId: id,
    action: isActive ? 'update' : 'delete',
    after: { is_active: isActive },
    reason: `Bulk ${isActive ? 'activate' : 'deactivate'}`,
  });

  return { ok: true, label };
}

export async function moveProductCategory(
  supabase: SupabaseClient,
  id: string,
  category: string,
  subCategory: string | null,
  label: string,
  audit: AuditRecorder
): Promise<BulkRowOutcome> {
  const { data: previous } = await supabase
    .from('products')
    .select('category, sub_category')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('products')
    .update({ category, sub_category: subCategory, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { ok: false, label, error: error.message };

  audit({
    entityType: 'product',
    entityId: id,
    action: 'update',
    before: previous,
    after: { category, sub_category: subCategory },
    reason: 'Bulk category move',
  });

  return { ok: true, label };
}

/**
 * A percentage move applied to the product price and to every variant price in
 * its pricing_config, then re-synced into product_variants — the same two-step
 * an ordinary product save performs. Writing product_variants alone would look
 * right until the next save re-derived them from the untouched config.
 */
export async function adjustProductPrice(
  supabase: SupabaseClient,
  id: string,
  percent: number,
  label: string,
  audit: AuditRecorder
): Promise<BulkRowOutcome> {
  const { data: product, error: readError } = await supabase
    .from('products')
    .select('price, pricing_config')
    .eq('id', id)
    .maybeSingle();

  if (readError) return { ok: false, label, error: readError.message };
  if (!product) return { ok: false, label, error: 'Product not found' };

  const next = adjustPricing(
    { price: Number(product.price) || 0, pricing_config: product.pricing_config as any },
    percent
  );

  const { error } = await supabase
    .from('products')
    .update({
      price: next.price,
      pricing_config: next.pricing_config as any,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { ok: false, label, error: error.message };

  await syncVariants(supabase, id);

  audit({
    entityType: 'product',
    entityId: id,
    action: 'update',
    before: { price: product.price },
    after: { price: next.price },
    reason: `Bulk price adjustment (${describePercent(percent)})`,
  });

  return { ok: true, label };
}

// setVariantStock lives in ./bulk-stock-action.ts — it is the only handler
// here that also moves inventory and sends mail, which is a different job from
// editing a catalogue row. Re-exported so the route keeps one import.
export { setVariantStock } from './bulk-stock-action';
