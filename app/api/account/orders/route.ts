// app/api/account/orders/route.ts - the signed-in customer's own orders.
//
// The heart of the feature: what /track-order allowed one order at a time,
// against the order number plus a matching contact, this returns for every
// order that contact ever placed. The trust model is the same one — control of
// the email on the order — established once at sign-in instead of retyped per
// lookup.
//
// Also serves the saved delivery details, because the two callers want them
// together: the account page shows them, and checkout prefills from them.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { optionalCustomer } from '@/lib/api/customer-session';
import { loadCustomerOrders, loadSavedDetails } from '@/lib/commerce/account-query';

export async function GET(request: NextRequest) {
  // Checkout asks this on every page load, most of them guests — so being
  // signed out is answered, not refused. See optionalCustomer.
  const customer = await optionalCustomer(request);
  if (!customer) return NextResponse.json({ success: true, signedIn: false, orders: [], saved: null });

  const supabase = createAdminClient();

  // Checkout wants the saved address and nothing else. Reading forty orders to
  // prefill six inputs would be work nobody asked for on the page where speed
  // matters most.
  const onlySaved = new URL(request.url).searchParams.get('only') === 'saved';

  // Neither read depends on the other.
  const [orders, saved] = await Promise.all([
    onlySaved ? Promise.resolve([]) : loadCustomerOrders(supabase, customer),
    loadSavedDetails(supabase, customer),
  ]);

  return NextResponse.json({
    success: true,
    signedIn: true,
    customer: { email: customer.email, fullName: customer.fullName },
    orders,
    saved,
  });
}
