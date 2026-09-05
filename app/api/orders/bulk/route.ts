// app/api/orders/bulk/route.ts - one status change applied to many orders.
//
// Marking a courier batch as shipped used to mean opening each order in turn.
// This is the same operation, batched — and it routes every row through
// applyOrderStatusTransition, exactly as PUT /api/orders/[id] does, so bulk
// changes reserve and restore stock, record order_status_history and notify
// the customer identically. A second, weaker write path for the same data is
// how inventory silently desyncs.
//
// Partial failure is normal here and is reported, not hidden: an order already
// cancelled cannot be shipped, and the operator needs to know which one it was.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { ORDER_STATUSES, formatOrderStatus } from '@/lib/commerce/order-status';
import { isCancellationCode, cancellationLabel } from '@/lib/commerce/cancellation-reasons';
import { applyOrderStatusTransition } from '@/lib/commerce/order-status-transition';
import { parseBulkIds, runBulk, MAX_BULK_ROWS } from '@/lib/api/bulk';
import type { OrderStatus } from '@/types/order';

export const maxDuration = 60;

export const POST = withAdminAuth(async (request, { supabase, actor, audit }) => {
  const body = await request.json().catch(() => null);

  const ids = parseBulkIds(body?.ids);
  if (!ids) {
    return NextResponse.json(
      { success: false, error: `Select between 1 and ${MAX_BULK_ROWS} orders.` },
      { status: 400 }
    );
  }

  const status = body?.status;
  if (!status || !(ORDER_STATUSES as string[]).includes(status)) {
    return NextResponse.json(
      { success: false, error: `Invalid status. Must be one of: ${ORDER_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  // A bulk cancellation is still a cancellation, and the whole point of the
  // fixed vocabulary is that there is no route to 'cancelled' that skips it.
  // Twenty orders killed in one click with no ground would be the largest hole
  // in the report, not the smallest.
  const reasonCode = body?.reason_code;
  if (status === 'cancelled' && !isCancellationCode(reasonCode)) {
    return NextResponse.json(
      { success: false, error: 'Choose why these orders are being cancelled.' },
      { status: 400 }
    );
  }

  const sendNotification = body?.sendNotification !== false;
  const reason = typeof body?.reason === 'string' ? body.reason : null;

  // Order numbers up front, so a failure reads "GM-1042 could not be shipped"
  // rather than quoting a uuid at somebody holding a packing list.
  const { data: rows } = await supabase
    .from('orders')
    .select('id, order_number')
    .in('id', ids);
  const numbers = new Map<string, string>((rows ?? []).map((row: any) => [row.id, row.order_number]));

  const outcome = await runBulk(ids, async (id) => {
    const label = numbers.get(id) ?? id;

    const result = await applyOrderStatusTransition(supabase, id, status as OrderStatus, {
      sendNotification,
      // Left unset for a cancellation so the transition writes the ground's own
      // sentence — "we could not fulfil it" rather than "your order status has
      // been updated to: Cancelled", which is not a message to send someone
      // who has paid.
      notificationMessage: status === 'cancelled'
        ? undefined
        : `Your order status has been updated to: ${formatOrderStatus(status)}`,
      // Every order in the batch names the same admin and carries the same
      // reason — which is exactly what happened.
      actor: { id: actor.id, email: actor.email },
      reason,
      reasonCode: status === 'cancelled' ? reasonCode : null,
    });

    if (!result.success) return { ok: false, label, error: result.error };

    audit({
      entityType: 'order',
      entityId: id,
      action: 'status_change',
      before: { status: result.previousStatus },
      after: {
        status,
        payment_verified: result.order?.payment_verified,
        ...(status === 'cancelled' ? { reason_code: reasonCode } : {}),
      },
      reason: status === 'cancelled'
        ? [cancellationLabel(reasonCode), reason].filter(Boolean).join(' — ')
        : reason ?? `Bulk status change to ${formatOrderStatus(status)}`,
    });

    return { ok: true, label };
  });

  // 200 even when some rows failed: the request itself was handled, and the
  // per-row results are the answer. A 500 here would tell the client to retry
  // the whole batch, re-notifying every customer whose order already moved.
  return NextResponse.json({
    success: outcome.failed === 0,
    action: 'status',
    status,
    ...outcome,
  });
});
