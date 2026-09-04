// app/api/account/session/route.ts - "is anybody signed in?"
//
// Exists because the session cookie is httpOnly by design, so the browser
// cannot answer this for itself. Checkout needs to know before it renders:
// a signed-in shopper goes straight through with their details filled in, and
// a signed-out one is offered the choice.
//
// Answers 200 either way. Being signed out is the normal state of most
// browsers, not an error, and a 401 here would put a red line in the console
// of every guest who opens the cart.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { readSession } from '@/lib/commerce/customer-auth';
import { sessionTokenFrom } from '@/lib/api/customer-session';

export async function GET(request: NextRequest) {
  const token = sessionTokenFrom(request);

  // No cookie, no database read. This runs on every checkout page load, and
  // the overwhelming majority of them are guests.
  if (!token) return NextResponse.json({ signedIn: false });

  const customer = await readSession(createAdminClient(), token);

  return customer
    ? NextResponse.json({ signedIn: true, email: customer.email, name: customer.fullName })
    : NextResponse.json({ signedIn: false });
}
