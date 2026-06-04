// app/api/admin/products/stock/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifyAdminAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, category, stock, colors, sizes, price')
      .eq('is_active', true)
      .order('stock', { ascending: true });

    if (error) {
      console.error('Error fetching stock:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch stock data', products: [] },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      products: products || []
    });
    
  } catch (error: any) {
    console.error('Stock API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', products: [] },
      { status: 500 }
    );
  }
}