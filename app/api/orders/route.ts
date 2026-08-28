// app/api/orders/route.ts - order listing (admin) and order creation (checkout).
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { createCustomerOrder } from '@/lib/commerce/create-order';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';

// GET method - fetch orders (for admin dashboard)
async function listOrders(supabase: SupabaseClient, request: NextRequest) {
  // Get status filter from query params
  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  console.log('Fetching orders with status:', status || 'all');

  let query = supabase
    .from('orders')
    .select(`*, order_items (*), order_change_requests (*), order_status_history (*)`)
    .order('created_at', { ascending: false });

  // Apply status filter if provided
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data: orders, error } = await query;

  if (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { success: false, error: `Failed to fetch orders: ${error.message}`, orders: [] },
      { status: 500 }
    );
  }

  console.log(`✅ Found ${orders?.length || 0} orders`);

  return NextResponse.json({
    success: true,
    orders: orders || []
  });
}

export const GET = withAdminAuth((request, { supabase }) => listOrders(supabase, request));

/**
 * POST — create an order (public; called by the checkout flow).
 *
 * A thin adapter: the body describes *what* is being bought and *where* it is
 * going, and createCustomerOrder() prices it against the live catalogue. No
 * amount from the request body is ever persisted — see
 * lib/commerce/price-order.ts.
 */
async function createOrder(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const result = await createCustomerOrder(supabase, await request.json());

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, code: result.code, quote: result.quote },
        { status: result.status }
      );
    }

    // A replay is a success, but it is not a creation — saying "created" here
    // would make a retry look like a second order in the logs.
    if (result.replayed) {
      console.log(`↩ Idempotent replay: ${result.order.order_number}`);
    } else {
      console.log(`✅ Order created successfully: ${result.order.order_number}`);
    }

    return NextResponse.json({
      success: true,
      message: result.replayed ? 'Order already submitted' : 'Order created successfully',
      order_id: result.order.id,
      order_number: result.order.order_number,
      replayed: result.replayed === true,
    }, { status: result.replayed ? 200 : 201 });

  } catch (error: any) {
    console.error('Error in orders POST API:', error);
    return NextResponse.json(
      { success: false, error: 'We could not process your order. Please try again.' },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(
  RATE_LIMITS.createOrder,
  createOrder,
  'Too many orders from this connection. Please wait a while, or contact us if this is a mistake.'
);

// NOTE: a collection-level `PUT /api/orders` used to live here, writing
// `status`/`payment_verified` straight onto an order row. It had no call sites
// anywhere in the repo — every status change goes through
// PUT /api/orders/[id], which routes through applyOrderStatusTransition and so
// also reserves/restores stock, records order_status_history, and notifies the
// customer. The removed handler did none of that and didn't even validate the
// status against ORDER_STATUSES, so any use of it would have silently desynced
// inventory. Deleted rather than kept as a second, weaker write path for the
// same data this route now prices authoritatively.
