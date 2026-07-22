// app/api/orders/[id]/shipping/route.ts - admin override of an order's
// shipping method, delegating the actual mutation to
// lib/commerce/order-shipping-transition.ts so the change-request approval
// flow can trigger the exact same behavior.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifyAdminAuth } from '@/lib/auth';
import { applyOrderShippingTransition } from '@/lib/commerce/order-shipping-transition';

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

    const result = await applyOrderShippingTransition(supabase, orderId, {
      shippingZoneId: shipping_zone_id,
      deliveryOption: delivery_option,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({
      success: true,
      order: result.order,
      message: 'Shipping method updated',
      channels: result.channels,
    });

  } catch (error: any) {
    console.error('Error updating order shipping:', error);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}
