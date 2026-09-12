/**
 * How a product save works, as opposed to how it is routed.
 *
 * Extracted from route.ts to keep that file about request handling.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Replaces a product's variant rows from the form's flat variant array — see
 * buildVariantRowsFromForm in lib/commerce/product-form-helpers.ts.
 *
 * The replacement lives in SQL (replace_product_variants) rather than here, so
 * an import and a form save cannot drift apart on how a variant key or a
 * price is derived.
 *
 * Best-effort: the product row is already written by the time this runs, and a
 * failure here leaves the variants stale rather than losing the edit. It is
 * logged loudly because stale variants mean wrong prices and stock, and the
 * fix is to re-save the product.
 */
export async function writeVariants(
  supabase: SupabaseClient,
  productId: string,
  variants: unknown
): Promise<void> {
  const { error } = await supabase.rpc('replace_product_variants', {
    p_product_id: productId,
    p_variants: variants,
  });

  if (error) {
    console.error(
      `CRITICAL: product ${productId} saved but its variants were not written (${error.message}). ` +
      `Prices and stock for it are now stale — re-save the product.`
    );
  }
}
