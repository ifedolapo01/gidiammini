// app/api/orders/[id]/refunds/route.ts - what has gone back on this order,
// and issuing more.
//
// GET is deliberately its own endpoint rather than another relation embedded
// on GET /api/orders/[id]: refunds are read only inside the refund panel,
// which most orders never open, and the order detail fetch is already carrying
// items, change requests and status history.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { parseJsonBody } from '@/lib/api/parse-body';
import { refundCreateSchema } from '@/lib/api/schemas/admin-orders';
import { recordOrderRefund } from '@/lib/commerce/order-refunds';

const REFUND_COLUMNS =
  'id, status, amount, method, reference, reason_code, note, refunded_at, actor_email, created_at';

export const GET = withAdminAuth(async (_request, { supabase, params }) => {
  const { id } = await params;

  const [{ data: refunds, error }, { data: order }] = await Promise.all([
    supabase
      .from('order_refunds')
      .select(REFUND_COLUMNS)
      .eq('order_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('total_amount, amount_paid, amount_refunded')
      .eq('id', id)
      .maybeSingle(),
  ]);

  if (error) {
    console.error('Error loading refunds:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load refunds', refunds: [] },
      { status: 500 }
    );
  }

  const paid = Number((order as any)?.amount_paid ?? 0);
  const refunded = Number((order as any)?.amount_refunded ?? 0);

  return NextResponse.json({
    success: true,
    refunds: refunds ?? [],
    // The one figure the form needs and must not compute for itself: what is
    // still refundable is what arrived, less what has already gone back.
    totals: {
      total_amount: Number((order as any)?.total_amount ?? 0),
      amount_paid: paid,
      amount_refunded: refunded,
      refundable: Math.round((paid - refunded) * 100) / 100,
    },
  });
});

export const POST = withAdminAuth(async (request, { supabase, params, actor, audit }) => {
  const { id } = await params;

  const parsed = await parseJsonBody(request, refundCreateSchema);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data;

  const result = await recordOrderRefund(
    supabase,
    {
      orderId: id,
      amount: body.amount,
      method: body.method,
      reasonCode: body.reason_code,
      reference: body.reference || null,
      note: body.note || null,
      settled: body.settled,
      notify: body.notify,
    },
    { id: actor.id, email: actor.email }
  );

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  audit({
    entityType: 'order',
    entityId: id,
    action: 'refund',
    after: {
      refund_id: result.refundId,
      amount: body.amount,
      method: body.method,
      reason_code: body.reason_code,
      status: body.settled ? 'completed' : 'pending',
      reference: body.reference || null,
    },
    reason: body.note || null,
  });

  return NextResponse.json({
    success: true,
    refundId: result.refundId,
    refundedTotal: result.refundedTotal,
    refundable: result.refundable,
    notified: result.notified,
    message: body.settled
      ? 'Refund recorded as sent.'
      : 'Refund agreed. Mark it sent once the transfer goes out.',
  });
});
