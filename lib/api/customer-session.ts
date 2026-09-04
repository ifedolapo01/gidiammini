/**
 * CORE layer — the customer session cookie, and the guard every account route
 * runs through.
 *
 * One module owns the cookie's name and options so no route can set it with a
 * weaker flag set than another. All four matter:
 *
 *   * httpOnly — this cookie is read-authority over somebody's whole order
 *     history, addresses included. Script must not be able to read it.
 *   * secure in production — it must never cross a plain-HTTP hop. Left off
 *     locally, where there is no HTTPS to be had.
 *   * sameSite 'lax' — required, not incidental. The customer arrives by
 *     clicking a link in their email, which is a cross-site top-level
 *     navigation; 'strict' would drop the cookie on exactly that journey.
 *   * path '/' — checkout reads it for prefill, not only /account.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { readSession, type SignedInCustomer } from '@/lib/commerce/customer-auth';

export const CUSTOMER_COOKIE = 'customer-session';

/** 30 days, matching customer_sessions.expires_at. Two clocks for one fact,
 *  and the database's is the one that decides — the cookie merely stops being
 *  offered. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(CUSTOMER_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function sessionTokenFrom(request: NextRequest): string | null {
  return request.cookies.get(CUSTOMER_COOKIE)?.value ?? null;
}

/**
 * The signed-in customer, or a 401.
 *
 * Returns a discriminated result rather than throwing, so a route reads as
 * "who is this, and if nobody, answer" in two lines. The 401 body is
 * deliberately plain: a signed-out browser is not an error condition, it is
 * the normal state of most requests.
 */
export type CustomerGuard =
  | { ok: true; customer: SignedInCustomer; token: string }
  | { ok: false; response: NextResponse };

/**
 * The signed-in customer, or null, without treating "signed out" as a failure.
 *
 * For the endpoints a page probes speculatively — "fill this in if you can",
 * "sync this if there is an account" — where being a guest is the normal
 * answer rather than an error. They answer 200 with signedIn:false, because a
 * 401 there puts a red line in the console of every guest who opens the cart,
 * for a question that was only ever optional.
 *
 * Mutations keep requireCustomer and its 401: there, being signed out really
 * does mean the request cannot be honoured.
 */
export async function optionalCustomer(request: NextRequest): Promise<SignedInCustomer | null> {
  const token = sessionTokenFrom(request);
  if (!token) return null;

  return readSession(createAdminClient(), token);
}

export async function requireCustomer(request: NextRequest): Promise<CustomerGuard> {
  const token = sessionTokenFrom(request);
  const supabase = createAdminClient();
  const customer = token ? await readSession(supabase, token) : null;

  if (!customer || !token) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, signedIn: false, error: 'Please sign in to see your orders.' },
        { status: 401 }
      ),
    };
  }

  return { ok: true, customer, token };
}
