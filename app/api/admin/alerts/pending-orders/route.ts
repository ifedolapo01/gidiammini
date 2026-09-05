// app/api/admin/alerts/pending-orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { isAdminRequest } from '@/lib/api/admin-session';

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest())) {
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
        pendingCount: 0,
        awaitingReceiptCount: 0
      });
    }

    // Pending orders with nothing uploaded yet.
    //
    // The worklist shows this rather than pendingCount, and the two are not
    // the same: a pending order WITH a receipt is already counted by the
    // receipts-to-verify row, and a number whose expansion lists fewer items
    // than it claims is a number nobody trusts again. This one is customers to
    // nudge; that one is receipts to check.
    const { count: awaitingReceiptCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('payment_verified', false)
      .is('receipt_path', null);

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
      awaitingReceiptCount: awaitingReceiptCount || 0,
      recentPending: recentPending || []
    });
    
  } catch (error: any) {
    console.error('Error fetching pending orders:', error);
    return NextResponse.json(
      { 
        success: false, 
        pendingCount: 0,
        awaitingReceiptCount: 0,
        recentPending: [],
        error: error.message 
      },
      { status: 500 }
    );
  }
}