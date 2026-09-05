// lib/supabase/admin-auth-server.ts — the admin's Supabase Auth session.
//
// A fourth factory alongside ./server, ./public-server and ./admin-server,
// and the only one that carries an admin identity. ./server exists for a
// customer-facing SSR session this app does not use; keeping the admin's own
// factory separate means the cookie names, the httpOnly decision and the
// admin-only semantics live in one file rather than being a flag on a shared
// one.
//
// WHY THE COOKIES ARE httpOnly
//
// Supabase's default browser setup stores the session where JavaScript can
// read it, because the browser client needs the access token. This app does
// not need that: every admin read and write goes through a server route using
// the service-role key, so the only thing the browser genuinely needs a token
// for is the realtime socket — and that gets a short-lived access token from
// /api/admin/realtime-token, held in memory and never persisted.
//
// So the refresh token, which is the durable credential, stays httpOnly and
// out of reach of any script running on the page. That is strictly stronger
// than the default arrangement, and it preserves the property the previous
// custom `admin-token` cookie had.
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/types/database';

/** Applied to every auth cookie Supabase sets. */
const COOKIE_DEFAULTS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

function requireEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
  }

  return { url, anonKey };
}

/**
 * For Route Handlers and Server Components.
 *
 * Writing cookies throws in a Server Component, which is expected and ignored:
 * the middleware refreshes the session on every admin navigation, so a
 * component that only reads does not need to persist anything.
 */
export async function createAdminAuthClient() {
  const { url, anonKey } = requireEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, { ...options, ...COOKIE_DEFAULTS })
          );
        } catch {
          // Called from a Server Component — see above.
        }
      },
    },
  });
}

/**
 * For middleware, which has a request and a response rather than next/headers.
 *
 * The refreshed cookies have to land on both: on the response so the browser
 * gets them, and on the request so anything running later in the same pass
 * reads the new value rather than the expired one.
 */
export function createMiddlewareAuthClient(request: NextRequest, response: NextResponse) {
  const { url, anonKey } = requireEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, { ...options, ...COOKIE_DEFAULTS })
        );
      },
    },
  });
}
