// app/api/orders/returns/route.ts - customer-submitted return requests.
// Trust model matches /api/orders/track and /api/orders/change-requests:
// order number + email/phone, never auth. Replaces the old 'return_request'
// type on order_change_requests — see lib/commerce/returns.ts and
// 20260909130000_returns.sql for why returns needed a table of their own.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifyOrderContact } from '@/lib/commerce/order-lookup';
import { loadPublicStoreSettings } from '@/lib/commerce/store-settings-server';
import { createReturnRequest } from '@/lib/commerce/returns';
import { sendOrderEmail } from '@/lib/email';
import { escapeHtml, escapeHtmlWithBreaks, sanitizeHeader } from '@/lib/notifications/escape-html';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import { parseJsonBody } from '@/lib/api/parse-body';
import { createReturnSchema } from '@/lib/api/schemas/return-request';

async function notifyOwner(order: any, rmaNumber: string, reason: string) {
  await sendOrderEmail(
    process.env.STORE_OWNER_EMAIL || 'ifedolapoajayi0@gmail.com',
    sanitizeHeader(`Return requested: #${order.order_number} (${rmaNumber})`),
    `<p>${escapeHtml(order.customer_name)} (${escapeHtml(order.customer_email || order.customer_phone)}) ` +
      `requested a return for order #${escapeHtml(order.order_number)} — RMA ${escapeHtml(rmaNumber)}.</p>` +
      `<p>Reason: ${escapeHtmlWithBreaks(reason)}</p>` +
      `<p>Review it in the admin dashboard.</p>`
  );
}

async function submitReturnRequest(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request, createReturnSchema);
    if (!parsed.ok) return parsed.response;

    const { orderNumber, contact, reason, items } = parsed.data;

    const supabase = createAdminClient();

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, order_items (id, quantity), order_status_history (status, changed_at)')
      .eq('order_number', orderNumber)
      .single();

    if (error || !order || !verifyOrderContact(order, contact)) {
      return NextResponse.json(
        { success: false, error: "We couldn't find an order matching that order number and email/phone." },
        { status: 404 }
      );
    }

    const settings = await loadPublicStoreSettings();

    const result = await createReturnRequest(supabase, {
      order,
      reason,
      items: items.map((item) => ({ orderItemId: item.orderItemId, quantity: item.quantity })),
      windowDays: settings.returnWindowDays,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    try {
      await notifyOwner(order, result.rmaNumber, reason);
    } catch (emailError) {
      console.error('Return request owner notification error:', emailError);
    }

    return NextResponse.json({ success: true, rmaNumber: result.rmaNumber, returnId: result.returnId });
  } catch (error: any) {
    console.error('Error submitting return request:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(
  RATE_LIMITS.returnRequest,
  submitReturnRequest,
  'Too many requests. Please wait before submitting another.'
);
