// app/api/checkout/quote/route.ts - public checkout re-pricing.
//
// Called at the step-1 -> step-2 transition, before the customer is shown a
// bank account and an amount to transfer. The response is the authoritative
// price of their cart: if anything has changed since they added items (a
// discount expired, an admin edited a price, a delivery fee moved), this is
// where they find out — not after they have already sent money.
//
// Also where the order number is issued: the payment screen shows it as the
// bank transfer remark, so it must exist before the order row does. It is
// reserved against the checkout's idempotency key, so it is stable across
// retries within one attempt.
//
// Public by design, like /api/orders POST: it reads nothing the storefront
// doesn't already render, and returns no order or customer data.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { priceOrder, findStockShortage } from '@/lib/commerce/price-order';
import { reserveOrderNumber } from '@/lib/commerce/order-number';
import { isCustomerBlocked } from '@/lib/commerce/customer-identity';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import { parseJsonBody } from '@/lib/api/parse-body';
import { checkoutQuoteSchema } from '@/lib/api/schemas/public-orders';

async function quoteCheckout(request: NextRequest) {
  try {
    // A non-object body (null, an array, a bare string) used to reach
    // `body.items` and throw, answering a bad request with a 500.
    const parsed = await parseJsonBody(request, checkoutQuoteSchema);
    if (!parsed.ok) return parsed.response;

    const body = parsed.data;
    const supabase = createAdminClient();

    // Refuse a barred buyer here, before they are shown an account number and
    // an amount. The same check runs again at order creation, which is the
    // authoritative one — this exists so nobody transfers money into an order
    // that will be rejected. Fails open if the lookup errors.
    if (body.customer_email) {
      const blocked = await isCustomerBlocked(supabase, body.customer_email);
      if (blocked.blocked) {
        console.warn(`Refused a quote for blocked customer ${body.customer_email}: ${blocked.reason ?? 'no reason recorded'}`);
        return NextResponse.json(
          { success: false, error: 'We are not able to accept this order. Please contact us so we can help.' },
          { status: 403 }
        );
      }
    }

    const result = await priceOrder(supabase, {
      items: body.items,
      deliveryOption: body.delivery_option,
      selectedState: body.selected_state,
      selectedLga: body.selected_lga,
      selectedPlace: body.selected_place,
      // Untrusted, like everything else here: validated against the live
      // discount row, never against anything the browser claims about it.
      discountCode: body.discount_code,
      // Only for a code's per-customer limit, which is counted by email
      // because a guest checkout has no customer row yet.
      customerEmail: body.customer_email,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const shortage = findStockShortage(result.priced.items);
    if (shortage) {
      return NextResponse.json({ success: false, error: shortage }, { status: 409 });
    }

    // The customer is about to be shown this number and told to use it as their
    // transfer remark, so it is issued here rather than at insert time. Keyed by
    // the checkout attempt, so coming back and resubmitting returns the same
    // number instead of a new one.
    const reserved = await reserveOrderNumber(supabase, body.idempotency_key);
    if (!reserved.ok) {
      return NextResponse.json({ success: false, error: reserved.error }, { status: reserved.status });
    }

    return NextResponse.json({
      success: true,
      quote: result.priced,
      order_number: reserved.orderNumber,
    });
  } catch (error: any) {
    console.error('Error quoting checkout:', error);
    return NextResponse.json(
      { success: false, error: 'We could not price your order. Please try again.' },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(RATE_LIMITS.checkoutQuote, quoteCheckout);
