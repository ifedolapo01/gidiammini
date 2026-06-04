// app/api/admin/alerts/dashboard-stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifyAdminAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    
    // Get multiple stats in parallel
    const [
      { count: totalProducts },
      { count: pendingOrders },
      { count: todayOrders },
      { data: lowStockData }
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('orders').select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      supabase.from('products').select('*').lte('stock', 5).eq('is_active', true)
    ]);
    
    const lowStockCount = lowStockData?.length || 0;
    const todayOrdersCount = todayOrders || 0;
    
    return NextResponse.json({
      success: true,
      stats: {
        totalProducts: totalProducts || 0,
        pendingOrders: pendingOrders || 0,
        todayOrders: todayOrdersCount,
        lowStockCount
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({
      success: false,
      stats: null,
      error: error.message
    });
  }
}