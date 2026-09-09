// app/api/orders/track/route.ts - public order lookup for customers.
// Requires the order number AND the email/phone used at checkout, so an order
// number alone (guessable — it's just "UT" + a timestamp) can't be used to
// view someone else's name, address, and items.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifyOrderContact } from '@/lib/commerce/order-lookup';
import { deliveredAtFrom } from '@/lib/commerce/order-status';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import { parseJsonBody } from '@/lib/api/parse-body';
import { trackOrderSchema } from '@/lib/api/schemas/public-orders';
import type { ActiveReturnSummary } from '@/types/return';

/** The one non-terminal return on this order, narrowed to what a customer's
 *  browser needs — never the item list or an admin actor. Typed loosely until
 *  `npm run db:types` reruns against a database that has this migration. */
async function activeReturnFor(supabase: SupabaseClient, orderId: string): Promise<ActiveReturnSummary | null> {
  const { data } = await supabase
    .from('returns')
    .select('id, rma_number, status, requested_at')
    .eq('order_id', orderId)
    .not('status', 'in', '(rejected,refunded)')
    .order('requested_at', { ascending: false })
    .maybeSingle();

  return (data as ActiveReturnSummary | null) ?? null;
}

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
      // order_status_history is selected narrowly and never returned as-is —
      // an admin actor's email and internal reason codes have no business
      // reaching a customer's browser. Only the derived delivered_at below is.
      .select(`*, order_items (*), order_change_requests (*), order_status_history (status, changed_at), order_messages (*)`)
      .eq('order_number', orderNumber)
      .single();

    if (error || !order || !verifyOrderContact(order, contact)) {
      return NextResponse.json({ success: false, error: NOT_FOUND_MESSAGE }, { status: 404 });
    }

    const { order_status_history, ...publicOrder } = order;
    const activeReturn = await activeReturnFor(supabase as unknown as SupabaseClient, order.id);

    return NextResponse.json({
      success: true,
      order: {
        ...publicOrder,
        delivered_at: deliveredAtFrom(order_status_history),
        active_return: activeReturn,
      },
    });
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
