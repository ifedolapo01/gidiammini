// app/api/admin/alerts/pending-orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifyAdminAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    
    // Get pending orders count
    const { count: pendingCount, error: countError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (countError) {
      console.error('Error counting pending orders:', countError);
      return NextResponse.json({
        success: false,
        pendingCount: 0
      });
    }

    // Get recent pending orders for details
    const { data: recentPending, error: recentError } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, total_amount')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(3);

    return NextResponse.json({
      success: true,
      pendingCount: pendingCount || 0,
      recentPending: recentPending || []
    });
    
  } catch (error: any) {
    console.error('Error fetching pending orders:', error);
    return NextResponse.json(
      { 
        success: false, 
        pendingCount: 0,
        recentPending: [],
        error: error.message 
      },
      { status: 500 }
    );
  }
}