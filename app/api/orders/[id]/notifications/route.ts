/**
 * What this order's customer has been sent, and sending one of it again.
 *
 * GET is the timeline on the order screen. POST resends.
 *
 * A resend builds a fresh message from the order as it stands now rather than
 * replaying the old one — the table records that a message went out, not what
 * it said. Which kinds that is honest for is decided in
 * lib/notifications/kinds.ts, and the reasoning is there rather than here.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, type AdminRouteContext } from '@/lib/api/with-admin-auth';
import { sendOrderReceivedEmail, sendOrderStatusUpdate } from '@/lib/notifications';
import { isResendable } from '@/lib/notifications/kinds';
import { anyDelivered, describeDelivery } from '@/lib/notifications/delivery';

export const dynamic = 'force-dynamic';

/** A shop that has mailed one order more than this has a different problem. */
const MAX_ROWS = 100;

const TIMELINE_COLUMNS =
  'id, channel, kind, recipient, subject, status, failure_reason, failure_detail,' +
  ' provider_message_id, actor_id, resend_of, created_at';

async function listNotifications(orderId: string, { supabase }: AdminRouteContext) {
  const { data, error } = await supabase
    .from('notifications')
    .select(TIMELINE_COLUMNS)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);

  if (error) {
    // Almost always a deployment that has not run 20260906140000 yet. The
    // order screen must still render, so this is an empty timeline with a flag
    // rather than a failed page.
    console.error('Could not read the notification timeline:', error);
    return NextResponse.json({ success: true, notifications: [], unavailable: true });
  }

  return NextResponse.json({ success: true, notifications: data ?? [] });
}

async function resendNotification(
  orderId: string,
  request: NextRequest,
  { supabase, actor }: AdminRouteContext
) {
  const body = await request.json().catch(() => null);
  const notificationId = typeof body?.notificationId === 'string' ? body.notificationId : null;

  if (!notificationId) {
    return NextResponse.json(
      { success: false, error: 'Which message should be sent again?' },
      { status: 400 }
    );
  }

  // Scoped to this order, so an id from another order cannot be replayed here.
  const { data: original } = await supabase
    .from('notifications')
    .select('id, kind, channel')
    .eq('id', notificationId)
    .eq('order_id', orderId)
    .maybeSingle();

  if (!original) {
    return NextResponse.json({ success: false, error: 'That message is not on this order.' }, { status: 404 });
  }

  if (original.channel !== 'email' || !isResendable(original.kind)) {
    return NextResponse.json(
      { success: false, error: 'That kind of message cannot be sent again. Send a new message instead.' },
      { status: 400 }
    );
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, customer_email, customer_phone, status, customer_id')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
  }

  if (!order.customer_email) {
    return NextResponse.json(
      { success: false, error: 'There is no email address on this order to send to.' },
      { status: 400 }
    );
  }

  const context = {
    orderId: order.id,
    customerId: order.customer_id ?? null,
    actorId: actor.id,
    resendOf: original.id,
  };

  if (original.kind === 'order_received') {
    const result = await sendOrderReceivedEmail({
      ...context,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
    });

    return result.success
      ? NextResponse.json({ success: true, message: 'Confirmation sent again.' })
      : NextResponse.json({ success: false, error: result.detail }, { status: 502 });
  }

  // status_change. Email only — a resend is answering "I never got the email",
  // and quietly sending a second SMS to somebody who did get that one is not
  // what was asked for.
  const delivery = await sendOrderStatusUpdate({
    ...context,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: '',
    oldStatus: order.status,
    newStatus: order.status,
  });

  if (!anyDelivered(delivery)) {
    return NextResponse.json(
      { success: false, error: describeDelivery(delivery), delivery },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, message: 'Update sent again.', delivery });
}

export const GET = withAdminAuth(async (_request, ctx) => {
  const { id } = await ctx.params;
  return listNotifications(id, ctx);
});

export const POST = withAdminAuth(async (request, ctx) => {
  const { id } = await ctx.params;
  return resendNotification(id, request, ctx);
});
