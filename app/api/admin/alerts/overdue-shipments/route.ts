// app/api/admin/alerts/overdue-shipments/route.ts - orders sitting in
// 'confirmed' past their shipping zone's ETA window, i.e. the admin likely
// forgot to move them to 'shipped'.
//
// The query and the rule live in lib/commerce/overdue-orders.ts, shared with
// the admin orders list's "Overdue" filter — this ticker and that filter must
// never disagree about which orders are late.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { isAdminRequest } from '@/lib/api/admin-session';
import { findOverdueOrders } from '@/lib/commerce/overdue-orders';

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const overdueOrders = await findOverdueOrders(createAdminClient());

    return NextResponse.json({
      success: true,
      overdueCount: overdueOrders.length,
      overdueOrders: overdueOrders.slice(0, 3),
    });

  } catch (error: any) {
    console.error('Error fetching overdue shipments:', error);
    return NextResponse.json(
      { success: false, overdueCount: 0, error: error.message },
      { status: 500 }
    );
  }
}
