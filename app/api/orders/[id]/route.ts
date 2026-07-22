// app/api/orders/[id]/route.ts - admin status updates, delegating the actual
// stock/notification work to lib/commerce/order-status-transition.ts so the
// change-request approval flow can trigger the exact same behavior.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifyAdminAuth } from '@/lib/auth';
import { ORDER_STATUSES, formatOrderStatus } from '@/lib/commerce/order-status';
import { applyOrderStatusTransition } from '@/lib/commerce/order-status-transition';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const body = await request.json();
    const {
      status,
      sendNotification = true,
      notificationMessage,
      payment_verified
    } = body;

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Status is required' },
        { status: 400 }
      );
    }

    if (!ORDER_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${ORDER_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const result = await applyOrderStatusTransition(supabase, id, status, {
      sendNotification,
      notificationMessage,
      paymentVerified: payment_verified,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({
      success: true,
      order: result.order,
      message: `Order status updated to ${formatOrderStatus(status)}`,
      stockUpdated: result.stockUpdated
    });

  } catch (error: any) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}
