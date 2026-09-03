// app/api/checkout/paystack/route.ts - starting an online payment.
//
// Creates the order first, then opens the payment. That order is exactly the
// same object the transfer flow creates — same pricing, same stock claim, same
// idempotency key — it simply has payment_method 'paystack' and no receipt.
//
// Creating before paying is deliberate. The stock has to be held while the
// customer is away at the provider, and 'pending' already means "stock claimed,
// money not confirmed" with a sweep that releases it if they never come back.
// The alternative — pay first, create after — would sell stock this shop might
// not have by the time the money lands.
//
// The amount is never taken from the request. priceOrder() computes the total
// from the catalogue, and the payment is opened for that figure.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import { parseJsonBody } from '@/lib/api/parse-body';
import { createOrderSchema } from '@/lib/api/schemas/public-orders';
import { createCustomerOrder } from '@/lib/commerce/create-order';
import { initializePayment, isPaystackConfigured } from '@/lib/payments/paystack';
import { absoluteUrl } from '@/lib/site-url';
import { randomBytes } from 'node:crypto';

/** "<order number>-<random>" — see the payment_reference column comment. */
function referenceFor(orderNumber: string): string {
  return `${orderNumber}-${randomBytes(4).toString('hex')}`;
}

async function startPayment(request: NextRequest) {
  if (!isPaystackConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Card payment is not available right now. Please pay by transfer.' },
      { status: 503 }
    );
  }

  const parsed = await parseJsonBody(request, createOrderSchema);
  if (!parsed.ok) return parsed.response;

  // Typed loosely until `npm run db:types` reruns against a database that has
  // migration 003800 — payment_reference and friends are not in the generated
  // types yet.
  const supabase: SupabaseClient = createAdminClient();

  const created = await createCustomerOrder(supabase, {
    ...parsed.data,
    // Decided here, not by the client: which endpoint was called is the only
    // honest source for how an order is being paid.
    payment_method: 'paystack',
  });

  if (!created.ok) {
    return NextResponse.json(
      { success: false, error: created.error, code: created.code, quote: created.quote },
      { status: created.status }
    );
  }

  // Read back rather than trusted from the request: this is the figure the
  // customer will actually be charged, and it has to be the one the server
  // priced.
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, customer_email, payment_verified')
    .eq('id', created.order.id)
    .single();

  if (!order) {
    return NextResponse.json(
      { success: false, error: 'We could not open that payment. Please try again.' },
      { status: 500 }
    );
  }

  // A replayed idempotency key for an order that is already paid: send them to
  // the receipt rather than charging them twice.
  if (order.payment_verified === true) {
    return NextResponse.json({ success: true, alreadyPaid: true, orderNumber: order.order_number });
  }

  const reference = referenceFor(order.order_number);

  try {
    const payment = await initializePayment({
      reference,
      amountNaira: order.total_amount,
      email: order.customer_email,
      orderNumber: order.order_number,
      callbackUrl: absoluteUrl(`/checkout/paid?reference=${encodeURIComponent(reference)}`),
    });

    // Stored before the customer leaves, so the webhook can find this order
    // even if they close the tab on the provider's page and never come back.
    await supabase
      .from('orders')
      .update({ payment_reference: payment.reference })
      .eq('id', order.id);

    return NextResponse.json({
      success: true,
      authorizationUrl: payment.authorizationUrl,
      orderNumber: order.order_number,
    });
  } catch (error: any) {
    // The order exists and holds stock; the sweep releases it if this is never
    // retried. Nothing is charged.
    console.error(`Paystack initialize failed for ${order.order_number}:`, error.message);
    return NextResponse.json(
      {
        success: false,
        error: 'We could not reach the payment provider. Please try again, or pay by transfer.',
        orderNumber: order.order_number,
      },
      { status: 502 }
    );
  }
}

export const POST = withRateLimit(
  RATE_LIMITS.createOrder,
  startPayment,
  'Too many payment attempts. Please wait a moment and try again.'
);
