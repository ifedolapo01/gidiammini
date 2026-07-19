// app/api/admin/products/[id]/stock/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { setVariantStock } from '@/lib/commerce/stock-adjustment';

async function updateProductStock(supabase: SupabaseClient, request: NextRequest, productId: string) {
  const body = await request.json();
  const { variantKey, stock } = body;

  if (variantKey === undefined || stock === undefined) {
    return NextResponse.json(
      { success: false, error: 'Variant key and stock are required' },
      { status: 400 }
    );
  }

  // Fetch current product config
  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('stock, pricing_config')
    .eq('id', productId)
    .single();

  if (fetchError || !product) {
    return NextResponse.json(
      { success: false, error: 'Product not found' },
      { status: 404 }
    );
  }

  const newStockVal = Math.max(0, parseInt(stock) || 0);
  const { stock: newTotalStock, pricingConfig: config } = setVariantStock(
    product.pricing_config,
    product.stock || 0,
    variantKey,
    newStockVal
  );

  const updateData: any = {
    stock: newTotalStock,
    pricing_config: config,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', productId)
    .select()
    .single();

  if (error) {
    console.error('Error updating product stock:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    product: data,
    message: 'Stock updated successfully'
  });
}

export const PUT = withAdminAuth(async (request, { supabase, params }) => {
  const { id } = await params;
  return updateProductStock(supabase, request, id);
});
