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
import { withAdminAuth } from '@/lib/api/with-admin-auth';

/** Raised by set_variant_stock() for input it won't accept. The message is
 * already written for a person. */
const INVALID_STOCK_SQLSTATE = 'GM003';

async function updateProductStock(supabase: SupabaseClient, request: NextRequest, productId: string) {
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

  return NextResponse.json({
    success: true,
    product: { id: productId, stock: result.stock, pricing_config: result.pricing_config },
    message: 'Stock updated successfully',
  });
}

export const PUT = withAdminAuth(async (request, { supabase, params }) => {
  const { id } = await params;
  return updateProductStock(supabase, request, id);
});
