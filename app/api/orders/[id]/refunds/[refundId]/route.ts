// app/api/orders/[id]/refunds/[refundId]/route.ts - an agreed refund goes out,
// or does not.
//
// Nested under the order rather than sitting at /api/refunds/[id] so the
// permission table governs it by the same pattern as everything else about an
// order, and so a refund id can never be settled against the wrong order by a
// caller that guessed one.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { parseJsonBody } from '@/lib/api/parse-body';
import { refundSettleSchema } from '@/lib/api/schemas/admin-orders';
import { settleOrderRefund } from '@/lib/commerce/refund-settlement';

export const PUT = withAdminAuth(async (request, { supabase, params, actor, audit }) => {
  const { id, refundId } = await params;

  const parsed = await parseJsonBody(request, refundSettleSchema);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data;

  const result = await settleOrderRefund(
    supabase,
    {
      refundId,
      outcome: body.outcome,
      reference: body.reference || null,
      note: body.note || null,
      notify: body.notify,
    },
    { id: actor.id, email: actor.email }
  );

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  // A refund settled against a different order than the URL claims is either a
  // bug or somebody probing. Either way it is worth seeing in the feed.
  if (result.orderId !== id) {
    console.warn(`Refund ${refundId} belongs to order ${result.orderId}, not ${id}.`);
  }

  audit({
    entityType: 'order',
    entityId: result.orderId,
    action: 'refund',
    after: {
      refund_id: refundId,
      status: body.outcome,
      reference: body.reference || null,
      refunded_total: result.refundedTotal,
    },
    reason: body.note || null,
  });

  return NextResponse.json({
    success: true,
    refundedTotal: result.refundedTotal,
    notified: result.notified,
    message: body.outcome === 'completed'
      ? 'Refund marked as sent.'
      : 'Refund marked as failed. Record another when you retry it.',
  });
});
