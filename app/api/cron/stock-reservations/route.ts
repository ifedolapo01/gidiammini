// app/api/cron/stock-reservations/route.ts - releases stock held by orders that
// were never verified.
//
// Stock is now claimed the moment an order is created (lib/commerce/persist-order.ts),
// which is what stops two customers buying the same last item. The cost of that
// is orders which are never resolved — a fake receipt, an abandoned transfer, a
// customer who changed their mind and never said — would otherwise hold
// inventory off the shelf forever.
//
// Cancelling (rather than just clearing the flag) is deliberate: a 'pending'
// order whose stock had been quietly released would be unfulfillable, and
// confirming it later would drive stock negative. Cancelling goes through the
// normal transition, so the stock is returned, the history row is written and
// the customer is told — all by the same code path an admin's manual cancel uses.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { applyOrderStatusTransition } from '@/lib/commerce/order-status-transition';
import { RESERVATION_HOURS } from '@/lib/commerce/persist-order';

export const maxDuration = 300;

const CANCELLATION_MESSAGE =
  'We were not able to verify payment for this order, so it has been cancelled and the items returned to stock. ' +
  'If you did pay, please reply with your receipt and we will sort it out right away.';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // Unlike the promotional crons, this one cancels orders. It fails closed
  // rather than running unauthenticated, so a missing secret can't turn a
  // public URL into a mass-cancel button.
  if (!secret) {
    console.error('CRON_SECRET is not set — refusing to run the stock-reservation sweep.');
    return NextResponse.json(
      { success: false, error: 'Cron is not configured on this deployment.' },
      { status: 503 }
    );
  }

  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // Housekeeping while we're here: rate-limit rows are keyed and upserted, so
    // the table is bounded by distinct (bucket, IP) pairs rather than by request
    // volume — but old entries still have no reason to stay.
    const { data: pruned } = await supabase.rpc('prune_rate_limits', { p_older_than_hours: 24 });
    if (typeof pruned === 'number' && pruned > 0) {
      console.log(`Pruned ${pruned} stale rate-limit rows.`);
    }

    const { data: expired, error } = await supabase
      .from('orders')
      .select('id, order_number')
      .eq('status', 'pending')
      .eq('payment_verified', false)
      .eq('stock_reserved', true)
      .lt('reserved_until', new Date().toISOString());

    if (error) throw error;

    if (!expired || expired.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No reservations older than ${RESERVATION_HOURS}h to release.`,
      });
    }

    let released = 0;
    const failures: string[] = [];

    for (const order of expired) {
      const result = await applyOrderStatusTransition(supabase, order.id, 'cancelled', {
        sendNotification: true,
        notificationMessage: CANCELLATION_MESSAGE,
      });

      if (result.success) {
        released++;
      } else {
        // Keep going: one order that won't cancel shouldn't strand the rest.
        console.error(`Failed to release reservation for ${order.order_number}: ${result.error}`);
        failures.push(order.order_number);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Released ${released} of ${expired.length} expired reservations.`,
      ...(failures.length > 0 && { failed: failures }),
    });
  } catch (error: any) {
    console.error('Stock reservation sweep error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
