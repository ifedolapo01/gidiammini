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

/**
 * GET — one order with the relations the list deliberately leaves behind.
 *
 * order_status_history and the full change-request rows are only ever read
 * inside the details modal. Embedding them on every row of the list meant
 * every order ever placed carried its whole history on every poll; fetching
 * them for the single order somebody actually opened costs one small query.
 */
export const GET = withAdminAuth(async (_request, { supabase, params }) => {
  const { id } = await params;

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items (*), order_change_requests (*), order_status_history (*)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error loading order:', error);
    return NextResponse.json({ success: false, error: 'Failed to load order' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, order: data });
});

export const PUT = withAdminAuth(async (request, { supabase, params, actor, audit }) => {
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
    // The order's own timeline gets the name and the reason too, so the
    // question "who cancelled this, and why" is answered on the order rather
    // than only by cross-referencing the activity feed.
    actor: { id: actor.id, email: actor.email },
    reason: typeof reason === 'string' ? reason : notificationMessage ?? null,
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
