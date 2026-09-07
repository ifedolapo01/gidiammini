// app/api/orders/messages/route.ts - a customer posting into the running
// conversation on their own order. Same trust model as change requests: order
// number + the contact used at checkout, never auth.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifyOrderContact } from '@/lib/commerce/order-lookup';
import { sendOrderEmail } from '@/lib/email';
import { escapeHtml, escapeHtmlWithBreaks, sanitizeHeader } from '@/lib/notifications/escape-html';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import { parseJsonBody } from '@/lib/api/parse-body';
import { orderMessageSchema } from '@/lib/api/schemas/public-orders';

async function postMessage(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request, orderMessageSchema);
    if (!parsed.ok) return parsed.response;

    const { orderNumber, contact, body } = parsed.data;

    const supabase = createAdminClient();

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, customer_email, customer_phone')
      .eq('order_number', orderNumber)
      .single();

    if (error || !order || !verifyOrderContact(order, contact)) {
      return NextResponse.json(
        { success: false, error: "We couldn't find an order matching that order number and email/phone." },
        { status: 404 }
      );
    }

    const { data: message, error: insertError } = await supabase
      .from('order_messages')
      .insert({ order_id: order.id, sender: 'customer', body })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ success: false, error: `Database error: ${insertError.message}` }, { status: 500 });
    }

    try {
      await sendOrderEmail(
        process.env.STORE_OWNER_EMAIL || 'ifedolapoajayi0@gmail.com',
        sanitizeHeader(`New message on order #${order.order_number}`),
        `<p>${escapeHtml(order.customer_name)} (${escapeHtml(order.customer_email || order.customer_phone)}) ` +
          `wrote on order #${escapeHtml(order.order_number)}:</p>` +
          `<p>${escapeHtmlWithBreaks(body)}</p>` +
          `<p>Reply from the admin dashboard.</p>`
      );
    } catch (emailError) {
      console.error('Order message owner notification error:', emailError);
    }

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error('Error posting order message:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(
  RATE_LIMITS.changeRequest,
  postMessage,
  'Too many messages. Please wait before sending another.'
);
