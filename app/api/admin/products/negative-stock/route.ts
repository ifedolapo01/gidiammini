// app/api/admin/products/negative-stock/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { isAdminRequest } from '@/lib/api/admin-session';
import { loadPublicStoreSettings } from '@/lib/commerce/store-settings-server';
import { DEFAULT_STORE_SETTINGS } from '@/lib/commerce/store-settings';

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // The shop's threshold, not a literal. This endpoint feeds the alert bar
    // at the top of every admin page, and it used to say 5 while the dashboard
    // said 10 — so the ticker and the card underneath it disagreed about how
    // many products were low.
    const { lowStockThreshold } = await loadPublicStoreSettings();

    const { data: lowStockProducts, error: lowStockError } = await supabase
      .from('products')
      .select('id, name, stock')
      .lte('stock', lowStockThreshold)
      .eq('is_active', true)
      .order('stock', { ascending: true });

    if (lowStockError) {
      console.error('Error fetching low stock products:', lowStockError);
      return NextResponse.json({
        success: false,
        lowStock: [],
        outOfStock: [],
        lowStockThreshold,
        count: 0
      });
    }

    // Separate low stock and out of stock
    const outOfStock = lowStockProducts?.filter(p => p.stock <= 0) || [];
    const lowStock = lowStockProducts?.filter(p => p.stock > 0 && p.stock <= lowStockThreshold) || [];

    return NextResponse.json({
      success: true,
      lowStock,
      outOfStock,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      // Returned so the alert can name the threshold it filtered on rather
      // than repeating a number of its own.
      lowStockThreshold,
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
        lowStockThreshold: DEFAULT_STORE_SETTINGS.lowStockThreshold,
        totalCount: 0,
        error: error.message 
      },
      { status: 500 }
    );
  }
}