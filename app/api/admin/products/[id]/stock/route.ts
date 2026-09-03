// app/api/admin/products/[id]/stock/route.ts - the admin Stock page's save.
//
// The arithmetic lives in the set_variant_stock() Postgres function
// (supabase/migrations/20251101002400_set_variant_stock.sql), not here. This
// route previously did SELECT -> compute in JS -> UPDATE with no lock, so two
// admins editing different variants of one product would have the second save
// discard the first (the whole pricing_config blob is rewritten), and an edit
// racing an order confirmation lost one of the two adjustments.
//
// The function holds a row lock across the read and the write, which is the same
// lock adjust_order_stock() takes — so admin edits and order transitions now
// serialise against each other rather than overwriting.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth, type AuditRecorder } from '@/lib/api/with-admin-auth';
import { notifyIfRestocked } from '@/lib/commerce/stock-alerts';

/** Raised by set_variant_stock() for input it won't accept. The message is
 * already written for a person. */
const INVALID_STOCK_SQLSTATE = 'GM003';

async function updateProductStock(
  supabase: SupabaseClient,
  request: NextRequest,
  productId: string,
  audit: AuditRecorder
) {
  const body = await request.json();
  const { variantKey, stock } = body;

  if (variantKey === undefined || stock === undefined) {
    return NextResponse.json(
      { success: false, error: 'Variant key and stock are required' },
      { status: 400 }
    );
  }

  const parsed = Number.parseInt(String(stock), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return NextResponse.json(
      { success: false, error: 'Stock must be a whole number of zero or more.' },
      { status: 400 }
    );
  }

  // The level before the change, so the trail says 12 -> 3 rather than just 3.
  const { data: previousVariant } = await supabase
    .from('product_variants')
    .select('stock')
    .eq('product_id', productId)
    .eq('variant_key', String(variantKey))
    .maybeSingle();

  // The product's total before the change, which is what decides whether this
  // save is a restock. A variant going 0 -> 5 while a sibling still had stock
  // is not: the product was buyable all along, and nobody waiting on it was
  // waiting for this.
  const { data: previousProduct } = await supabase
    .from('products')
    .select('stock')
    .eq('id', productId)
    .maybeSingle();

  const { data, error } = await supabase.rpc('set_variant_stock', {
    p_product_id: productId,
    p_variant_key: String(variantKey),
    p_new_stock: parsed,
  });

  if (error) {
    if (error.code === INVALID_STOCK_SQLSTATE) {
      // "Product not found." / "Stock cannot be negative." / unknown mode.
      const status = error.message.includes('not found') ? 404 : 400;
      return NextResponse.json({ success: false, error: error.message }, { status });
    }

    console.error('Error updating product stock:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update stock. Please try again.' },
      { status: 500 }
    );
  }

  const result = (data ?? {}) as { stock?: number; pricing_config?: unknown };

  audit({
    entityType: 'product_variant',
    // Addressed by variant key, which is why audit_log.entity_id is text.
    entityId: `${productId}:${variantKey}`,
    action: 'stock_change',
    before: { stock: previousVariant?.stock ?? null },
    after: { stock: parsed },
    reason: typeof body.reason === 'string' ? body.reason : null,
  });

  // Awaited so a restock is mailed before the admin is told the save worked —
  // but it cannot fail the save, and says so inside. The variant key is passed
  // through as a label so the mail can name what came back when a specific
  // variant is what returned.
  const notified = await notifyIfRestocked(
    supabase,
    productId,
    previousProduct?.stock,
    result.stock ?? 0,
    String(variantKey) === 'single' ? null : String(variantKey)
  );

  return NextResponse.json({
    success: true,
    product: { id: productId, stock: result.stock, pricing_config: result.pricing_config },
    // Surfaced so the Stock page can tell the admin their restock just mailed
    // eleven people — the feature is invisible otherwise, and an invisible
    // feature is one nobody trusts.
    stockAlertsNotified: notified.sent,
    message: notified.sent > 0
      ? `Stock updated. ${notified.sent} waiting customer${notified.sent === 1 ? '' : 's'} notified.`
      : 'Stock updated successfully',
  });
}

export const PUT = withAdminAuth(async (request, { supabase, params, audit }) => {
  const { id } = await params;
  return updateProductStock(supabase, request, id, audit);
});
