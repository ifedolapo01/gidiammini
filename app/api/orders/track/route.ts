// app/api/orders/track/route.ts - public order lookup for customers.
// Requires the order number AND the email/phone used at checkout, so an order
// number alone (guessable — it's just "UT" + a timestamp) can't be used to
// view someone else's name, address, and items.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifyOrderContact } from '@/lib/commerce/order-lookup';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import { parseJsonBody } from '@/lib/api/parse-body';
import { trackOrderSchema } from '@/lib/api/schemas/public-orders';

const NOT_FOUND_MESSAGE = "We couldn't find an order matching that order number and email/phone.";

async function trackOrder(request: NextRequest) {
  try {
    // The schema trims, length-caps and strips the leading '#' customers paste
    // from their confirmation email. A non-string order number used to reach
    // .trim() and 500.
    const parsed = await parseJsonBody(request, trackOrderSchema);
    if (!parsed.ok) return parsed.response;

    const { orderNumber, contact } = parsed.data;

    const supabase = createAdminClient();

    const { data: order, error } = await supabase
      .from('orders')
      .select(`*, order_items (*), order_change_requests (*)`)
      .eq('order_number', orderNumber)
      .single();

    if (error || !order || !verifyOrderContact(order, contact)) {
      return NextResponse.json({ success: false, error: NOT_FOUND_MESSAGE }, { status: 404 });
    }

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error('Error tracking order:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(
  RATE_LIMITS.orderTrack,
  trackOrder,
  "Too many lookups. Please wait a few minutes and try again."
);
