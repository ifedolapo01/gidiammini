// app/api/admin/products/[id]/stock/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifyAdminAuth } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const productId = id;
    
    const body = await request.json();
    const { variantKey, stock } = body;
    
    if (variantKey === undefined || stock === undefined) {
      return NextResponse.json(
        { success: false, error: 'Variant key and stock are required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    
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

    let newTotalStock = product.stock || 0;
    const config = product.pricing_config || { mode: 'single' };
    const newStockVal = Math.max(0, parseInt(stock) || 0);

    if (variantKey === 'single' || config.mode === 'single') {
      newTotalStock = newStockVal;
      config.singleStock = newStockVal;
    } else if (config.mode === 'combination') {
      const oldStock = config.combinationStock?.[variantKey] || 0;
      if (!config.combinationStock) config.combinationStock = {};
      config.combinationStock[variantKey] = newStockVal;
      newTotalStock = newTotalStock - oldStock + newStockVal;
    } else if (config.mode === 'size') {
      const oldStock = config.sizeStock?.[variantKey] || 0;
      if (!config.sizeStock) config.sizeStock = {};
      config.sizeStock[variantKey] = newStockVal;
      newTotalStock = newTotalStock - oldStock + newStockVal;
    } else if (config.mode === 'color') {
      const oldStock = config.colorStock?.[variantKey] || 0;
      if (!config.colorStock) config.colorStock = {};
      config.colorStock[variantKey] = newStockVal;
      newTotalStock = newTotalStock - oldStock + newStockVal;
    }

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
    
  } catch (error: any) {
    console.error('Stock update error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}