// app/api/admin/products/negative-stock/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifyAdminAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    
    // Get products with low or no stock
    const { data: lowStockProducts, error: lowStockError } = await supabase
      .from('products')
      .select('id, name, stock')
      .lte('stock', 5) // Products with 5 or less stock
      .eq('is_active', true)
      .order('stock', { ascending: true });

    if (lowStockError) {
      console.error('Error fetching low stock products:', lowStockError);
      return NextResponse.json({
        success: false,
        lowStock: [],
        outOfStock: [],
        count: 0
      });
    }

    // Separate low stock and out of stock
    const outOfStock = lowStockProducts?.filter(p => p.stock <= 0) || [];
    const lowStock = lowStockProducts?.filter(p => p.stock > 0 && p.stock <= 5) || [];

    return NextResponse.json({
      success: true,
      lowStock,
      outOfStock,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      totalCount: lowStockProducts?.length || 0
    });
    
  } catch (error: any) {
    console.error('Error fetching stock data:', error);
    return NextResponse.json(
      { 
        success: false, 
        lowStock: [],
        outOfStock: [],
        lowStockCount: 0,
        outOfStockCount: 0,
        totalCount: 0,
        error: error.message 
      },
      { status: 500 }
    );
  }
}