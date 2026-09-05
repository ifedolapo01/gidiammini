// app/api/orders/[id]/route.ts - admin status updates, delegating the actual
// stock/notification work to lib/commerce/order-status-transition.ts so the
// change-request approval flow can trigger the exact same behavior.
//
// Goes through withAdminAuth rather than checking the cookie itself. That is
// what puts a status change in the audit trail: the wrapper records the
// actor, the request and the response for every mutating call, and this handler
// adds the before/after status and the admin's reason. A route that checks auth
// on its own is a route whose changes leave no trace.
//
// TWO TRANSITIONS CARRY EXTRA FACTS, AND THIS IS WHERE THEY ARE DEMANDED
//
//   cancelled — a ground from the fixed vocabulary is required. Not optional,
//               because an optional field on the one action nobody enjoys
//               performing is a field that is always left blank, and the
//               question "why do 12% of our orders die" then stays permanently
//               unanswerable.
//   shipped   — courier and waybill are accepted and stored. Not required: a
//               parcel handed to the shop's own rider has no waybill, and
//               refusing the transition for want of one pushes the whole
//               status change back outside the system.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { badRequest } from '@/lib/api/parse-body';
import { ORDER_STATUSES, formatOrderStatus } from '@/lib/commerce/order-status';
import { cancellationLabel } from '@/lib/commerce/cancellation-reasons';
import { orderCancelSchema } from '@/lib/api/schemas/admin-orders';
import { applyOrderStatusTransition } from '@/lib/commerce/order-status-transition';

/**
 * GET — one order with the relations the list deliberately leaves behind.
 *
 * order_status_history and the full change-request rows are only ever read
 * inside the details modal. Embedding them on every row of the list meant
 * every order ever placed carried its whole history on every poll; fetching
 * them for the single order somebody actually opened costs one small query.
 *
 * Refunds are the exception that stays out: most orders have none, the panel
 * that shows them is opened rarely, and it has its own endpoint.
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
    reason_code,
    carrier,
    tracking_number,
    tracking_url,
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

  // Cancelling has requirements the rest of the workflow does not, so its own
  // fields are validated by their own schema rather than by another hand-rolled
  // check here. The body is parsed rather than the request, because the request
  // stream has already been read for the fields above.
  if (status === 'cancelled') {
    const cancellation = orderCancelSchema.safeParse({ reason_code, reason, notify: sendNotification });
    if (!cancellation.success) {
      return badRequest(
        Object.fromEntries(
          cancellation.error.issues.map((issue) => [issue.path.join('.') || '_', issue.message])
        )
      );
    }
  }

  const freeText = typeof reason === 'string' ? reason : notificationMessage ?? null;

  const result = await applyOrderStatusTransition(supabase, id, status, {
    sendNotification,
    notificationMessage,
    paymentVerified: payment_verified,
    // The order's own timeline gets the name and the reason too, so the
    // question "who cancelled this, and why" is answered on the order rather
    // than only by cross-referencing the activity feed.
    actor: { id: actor.id, email: actor.email },
    reason: freeText,
    reasonCode: status === 'cancelled' ? reason_code : null,
    // Ignored by the transition for every status but 'shipped', so passing it
    // unconditionally is safe and keeps the branch in one place.
    tracking: { carrier, trackingNumber: tracking_number, trackingUrl: tracking_url },
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status || 500 });
  }

  audit({
    entityType: 'order',
    entityId: id,
    action: 'status_change',
    before: { status: result.previousStatus },
    after: {
      status,
      payment_verified: result.order?.payment_verified,
      ...(status === 'cancelled' ? { reason_code } : {}),
      ...(status === 'shipped' && result.order?.tracking_number
        ? { carrier: result.order.carrier, tracking_number: result.order.tracking_number }
        : {}),
    },
    // "Cancelled by mistake" is the case this whole table exists for, so the
    // reason travels with it — the ground first, since that is what a later
    // reader is scanning for, then whatever was typed.
    reason: status === 'cancelled'
      ? [cancellationLabel(reason_code), freeText].filter(Boolean).join(' — ')
      : freeText,
  });

  return NextResponse.json({
    success: true,
    order: result.order,
    message: `Order status updated to ${formatOrderStatus(status)}`,
    stockUpdated: result.stockUpdated,
    delivery: result.delivery,
  });
});
