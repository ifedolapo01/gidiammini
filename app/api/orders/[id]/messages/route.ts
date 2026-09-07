// app/api/orders/[id]/messages/route.ts - the admin side of the conversation
// on an order: read the thread, and reply into it.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { sendCustomNotification } from '@/lib/notifications';

const MESSAGE_COLUMNS = 'id, order_id, sender, body, created_at';

export const GET = withAdminAuth(async (_request, { supabase, params }) => {
  const { id } = await params;

  const { data, error } = await supabase
    .from('order_messages')
    .select(MESSAGE_COLUMNS)
    .eq('order_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: 'Could not load the conversation.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, messages: data ?? [] });
});

export const POST = withAdminAuth(async (request, { supabase, params }) => {
  const { id } = await params;
  const { body } = await request.json();

  const trimmed = typeof body === 'string' ? body.trim() : '';
  if (!trimmed) {
    return NextResponse.json({ success: false, error: 'Write something before sending.' }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, customer_id, order_number, customer_name, customer_email, customer_phone')
    .eq('id', id)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
  }

  const { data: message, error: insertError } = await supabase
    .from('order_messages')
    .insert({ order_id: id, sender: 'admin', body: trimmed })
    .select(MESSAGE_COLUMNS)
    .single();

  if (insertError) {
    return NextResponse.json({ success: false, error: `Database error: ${insertError.message}` }, { status: 500 });
  }

  let delivery;
  try {
    delivery = await sendCustomNotification({
      orderId: order.id,
      customerId: order.customer_id ?? null,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      message: trimmed,
      viaEmail: true,
      viaSMS: false,
    });
  } catch (notificationError) {
    console.error('Order message customer notification error:', notificationError);
  }

  return NextResponse.json({ success: true, message, delivery });
});
