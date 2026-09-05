// app/api/orders/[id]/items/route.ts - editing what an order contains.
//
// A separate endpoint from PUT /api/orders/[id] on purpose. That one moves an
// order through its status workflow; this one changes what is in the box and
// what it costs. Folding them together would mean one handler where a body
// with the wrong shape could quietly do the other thing, and one audit action
// that cannot distinguish "marked shipped" from "removed two items and applied
// a discount".
//
// Everything transactional happens inside edit_order_items() — see
// lib/commerce/order-edit.ts. What this route adds is the permission check,
// the audit entry with the actual before/after, and the response the modal
// re-renders from.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { parseJsonBody } from '@/lib/api/parse-body';
import { orderEditSchema } from '@/lib/api/schemas/admin-orders';
import { editOrderItems } from '@/lib/commerce/order-edit';

export const PUT = withAdminAuth(async (request, { supabase, params, audit }) => {
  const { id } = await params;

  const parsed = await parseJsonBody(request, orderEditSchema);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data;

  const result = await editOrderItems(supabase, {
    orderId: id,
    items: body.items,
    // The schema leaves this nullish so "not mentioned" and "set to zero" stay
    // different instructions all the way down to the SQL.
    discountAmount: body.discount_amount ?? undefined,
    discountReason: body.discount_reason || null,
    note: body.note || null,
    notify: body.notify,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  // The audit entry records the money, because that is what anybody asks about
  // afterwards, and the line changes in words, because a jsonb dump of fifty
  // order_items is not readable at 9pm when somebody is trying to work out
  // what happened to an order.
  audit({
    entityType: 'order',
    entityId: id,
    action: 'update',
    before: { total_amount: result.totals.previous_total },
    after: {
      total_amount: result.totals.total_amount,
      items_subtotal: result.totals.items_subtotal,
      discount_amount: result.totals.discount_amount,
      changes: result.summary,
    },
    reason: body.note || null,
  });

  return NextResponse.json({
    success: true,
    totals: result.totals,
    changes: result.changes,
    summary: result.summary,
    notified: result.notified,
    message: result.summary.length
      ? `Order updated — ${result.summary.length} change${result.summary.length === 1 ? '' : 's'} saved.`
      : 'Order updated.',
  });
});
