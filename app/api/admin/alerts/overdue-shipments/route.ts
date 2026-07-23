// app/api/admin/alerts/overdue-shipments/route.ts - orders sitting in
// 'confirmed' past their shipping zone's ETA window, i.e. the admin likely
// forgot to move them to 'shipped'.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifyAdminAuth } from '@/lib/auth';
import { getShippingOverdueInfo } from '@/lib/commerce/shipping-overdue';

export async function GET(request: NextRequest) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const [{ data: orders, error: ordersError }, { data: zones, error: zonesError }] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, customer_name, updated_at, status, delivery_option, selected_state, selected_lga, selected_place')
        .eq('status', 'confirmed')
        .eq('delivery_option', 'delivery'),
      supabase.from('shipping_zones').select('*, shipping_zone_exceptions(*)'),
    ]);

    if (ordersError || zonesError) {
      console.error('Error fetching overdue shipments:', ordersError || zonesError);
      return NextResponse.json({ success: false, overdueCount: 0 });
    }

    const overdueOrders = (orders || []).flatMap((order) => {
      const info = getShippingOverdueInfo(order, zones || []);
      if (!info) return [];

      return [{
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        hoursOverdue: info.hoursOverdue,
      }];
    });

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
