// app/api/orders/[id]/shipping/route.ts - admin override of an order's shipping method + auto-notify
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifyAdminAuth } from '@/lib/auth';
import { sendCustomNotification } from '@/lib/notifications';
import { formatZoneEta } from '@/lib/commerce/shipping-eta';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: orderId } = await params;
    const body = await request.json();
    const { shipping_zone_id, delivery_option } = body;

    if (!shipping_zone_id || !delivery_option) {
      return NextResponse.json(
        { success: false, error: 'shipping_zone_id and delivery_option are required' },
        { status: 400 }
      );
    }

    if (!['pickup', 'delivery'].includes(delivery_option)) {
      return NextResponse.json(
        { success: false, error: "delivery_option must be 'pickup' or 'delivery'" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const { data: zone, error: zoneError } = await supabase
      .from('shipping_zones')
      .select('*')
      .eq('id', shipping_zone_id)
      .single();

    if (zoneError || !zone) {
      return NextResponse.json({ success: false, error: 'Shipping zone not found' }, { status: 404 });
    }

    if (delivery_option === 'pickup' && !zone.pickup_available) {
      return NextResponse.json(
        { success: false, error: `${zone.name} does not offer pickup` },
        { status: 400 }
      );
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        shipping_zone_id: zone.id,
        selected_state: zone.state,
        selected_lga: zone.lga,
        selected_place: null,
        delivery_option,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: `Database error: ${updateError.message}` },
        { status: 500 }
      );
    }

    const shippingSummary = delivery_option === 'pickup'
      ? `Pickup from ${zone.pickup_address}`
      : `${zone.delivery_label} to ${zone.name} (${formatZoneEta(zone)})`;

    let channels: string[] = [];
    try {
      const notifyResult = await sendCustomNotification({
        orderNumber: order.order_number,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        message: `Your shipping method has been updated: ${shippingSummary}`,
        viaEmail: true,
        viaSMS: true,
      });
      channels = notifyResult.channels || [];
    } catch (notificationError) {
      console.error('Shipping update notification error:', notificationError);
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: 'Shipping method updated',
      channels,
    });

  } catch (error: any) {
    console.error('Error updating order shipping:', error);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}
