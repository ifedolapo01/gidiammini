// app/api/admin/products/[id]/stock/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = id;
    
    const body = await request.json();
    const { stock, colors, sizes } = body;
    
    if (stock === undefined && !colors && !sizes) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (stock !== undefined) {
      updateData.stock = Math.max(0, parseInt(stock) || 0);
    }
    
    if (colors) {
      updateData.colors = colors.filter((c: string) => c.trim() !== '');
    }
    
    if (sizes) {
      updateData.sizes = sizes.filter((s: string) => s.trim() !== '');
    }

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
      message: 'Product updated successfully'
    });
    
  } catch (error: any) {
    console.error('Stock update error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}