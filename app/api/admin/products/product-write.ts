/**
 * How a product save works, as opposed to how it is routed.
 *
 * Extracted from route.ts to keep that file about request handling. Both
 * functions are shared by the create and update paths.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Turns the pricing_config this form submits into product_variants rows.
 *
 * The derivation lives in SQL (sync_variants_from_pricing_config) rather than
 * here, so the migration's backfill and every subsequent save use the same
 * implementation and cannot drift apart.
 *
 * Best-effort: the product row is already written by the time this runs, and a
 * failure here leaves the variants stale rather than losing the edit. It is
 * logged loudly because stale variants mean wrong prices and stock, and the
 * fix is to re-save the product or re-run the sync.
 */
export async function syncVariants(supabase: SupabaseClient, productId: string): Promise<void> {
  const { error } = await supabase.rpc('sync_variants_from_pricing_config', {
    p_product_id: productId,
  });

  if (error) {
    console.error(
      `CRITICAL: product ${productId} saved but its variants were not synced (${error.message}). ` +
      `Prices and stock for it are now stale — re-save the product.`
    );
  }
}

/**
 * Writes per-variant cost prices, keyed by variant key.
 *
 * Cost cannot travel through pricing_config: that blob is the legacy variant
 * model, sync_variants_from_pricing_config deliberately leaves cost alone so a
 * save from the old form cannot wipe it, and putting cost back in there would
 * undo the point of 20251101002600. So the form sends a separate
 * `variant_costs` map and it lands on the rows directly.
 *
 * Runs after the variant sync, so the rows it updates already exist. An empty
 * string or null clears a cost back to unknown, which is meaningfully different
 * from zero — zero cost would report the whole sale price as profit.
 */
export async function applyVariantCosts(
  supabase: SupabaseClient,
  productId: string,
  costs: unknown
): Promise<void> {
  if (!costs || typeof costs !== 'object' || Array.isArray(costs)) return;

  for (const [variantKey, raw] of Object.entries(costs as Record<string, unknown>)) {
    if (!variantKey) continue;

    let cost: number | null = null;
    if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0) continue;
      cost = Math.trunc(parsed);
    }

    const { error } = await supabase
      .from('product_variants')
      .update({ cost })
      .eq('product_id', productId)
      .eq('variant_key', variantKey);

    if (error) {
      console.error(`Could not set cost for ${productId} / ${variantKey}: ${error.message}`);
    }
  }
}
