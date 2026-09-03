// app/api/orders/[id]/route.ts - admin status updates, delegating the actual
// stock/notification work to lib/commerce/order-status-transition.ts so the
// change-request approval flow can trigger the exact same behavior.
//
// Goes through withAdminAuth rather than checking the cookie itself. That is
// what puts a status change in the audit trail: the wrapper records the
// actor, the request and the response for every mutating call, and this handler
// adds the before/after status and the admin's reason. A route that checks auth
// on its own is a route whose changes leave no trace.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { ORDER_STATUSES, formatOrderStatus } from '@/lib/commerce/order-status';
import { applyOrderStatusTransition } from '@/lib/commerce/order-status-transition';

export const PUT = withAdminAuth(async (request, { supabase, params, audit }) => {
  const { id } = await params;

  const body = await request.json();
  const {
    status,
    sendNotification = true,
    notificationMessage,
    payment_verified,
    reason,
  } = body;

  if (!status) {
    return NextResponse.json({ success: false, error: 'Status is required' }, { status: 400 });
  }

  if (!ORDER_STATUSES.includes(status)) {
    return NextResponse.json(
      { success: false, error: `Invalid status. Must be one of: ${ORDER_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  const result = await applyOrderStatusTransition(supabase, id, status, {
    sendNotification,
    notificationMessage,
    paymentVerified: payment_verified,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status || 500 });
  }

  audit({
    entityType: 'order',
    entityId: id,
    action: 'status_change',
    before: { status: result.previousStatus },
    after: { status, payment_verified: result.order?.payment_verified },
    // "Cancelled by mistake" is the case this whole table exists for, so the
    // reason travels with it when the UI collects one.
    reason: typeof reason === 'string' ? reason : notificationMessage ?? null,
  });

  return NextResponse.json({
    success: true,
    order: result.order,
    message: `Order status updated to ${formatOrderStatus(status)}`,
    stockUpdated: result.stockUpdated,
    delivery: result.delivery,
  });
});
