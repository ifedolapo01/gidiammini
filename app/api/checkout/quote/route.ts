// app/api/checkout/quote/route.ts - public checkout re-pricing.
//
// Called at the step-1 -> step-2 transition, before the customer is shown a
// bank account and an amount to transfer. The response is the authoritative
// price of their cart: if anything has changed since they added items (a
// discount expired, an admin edited a price, a delivery fee moved), this is
// where they find out — not after they have already sent money.
//
// Public by design, like /api/orders POST: it reads nothing the storefront
// doesn't already render, and returns no order or customer data.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { priceOrder, findStockShortage } from '@/lib/commerce/price-order';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createAdminClient();

    const result = await priceOrder(supabase, {
      items: body.items,
      deliveryOption: body.delivery_option,
      selectedState: body.selected_state,
      selectedLga: body.selected_lga,
      selectedPlace: body.selected_place,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const shortage = findStockShortage(result.priced.items);
    if (shortage) {
      return NextResponse.json({ success: false, error: shortage }, { status: 409 });
    }

    return NextResponse.json({ success: true, quote: result.priced });
  } catch (error: any) {
    console.error('Error quoting checkout:', error);
    return NextResponse.json(
      { success: false, error: 'We could not price your order. Please try again.' },
      { status: 500 }
    );
  }
}
