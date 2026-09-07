// middleware.ts
//
// Two jobs, on every /admin page and every /api/admin request:
//
//   1. Keep the Supabase session alive. getUser() refreshes an expired access
//      token and writes the rotated cookies onto the response — without this,
//      a tab left open overnight would 401 on its next action rather than
//      quietly carrying on.
//   2. Turn away anyone without an admin session, before the admin shell
//      renders or the route handler runs.
//
// The authorisation here is deliberately the cheap half. It trusts the
// `admin` flag stamped into app_metadata when the account was created, which
// travels in the JWT and costs nothing to read — but a claim only changes when
// a token refreshes, so it is not sufficient on its own. The authoritative
// check is a live read of public.admin_users in lib/api/admin-session.ts,
// which every admin API route goes through, and the RLS policies behind
// realtime, which call is_active_admin(). A deactivated admin can therefore
// still load an admin page until their token refreshes, and can do nothing
// whatsoever on it.
//
// The API half is defence in depth, not the real guard: /api/admin routes are
// protected by withAdminAuth (or, for the handful that predate it,
// getAdminActor). This means a new route that forgets its wrapper is refused
// here rather than silently public — and lib/api/admin-route-coverage.test.ts
// fails the build if one does forget, so neither layer is load-bearing alone.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareAuthClient } from '@/lib/supabase/admin-auth-server';
import { PUBLIC_ADMIN_API_PATHS } from '@/lib/api/admin-public-paths';

/** Trailing slashes are the same route, and must not be a way past the list. */
function normalise(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export async function middleware(request: NextRequest) {
  const pathname = normalise(request.nextUrl.pathname);
  const isApi = pathname.startsWith('/api/admin');

  const isLoginPage = pathname === '/admin/login';
  // The white-label favicon (app/admin/icon.tsx) must be publicly fetchable —
  // browsers request it unauthenticated, including from the login page itself.
  const isPublicAdminAsset = pathname === '/admin/icon';
  // Where an invited admin sets their password. They have no session yet —
  // that is what the page is for — so bouncing them to the login form would
  // make every invitation a dead end. The token in the URL is the credential,
  // and it is checked by /api/admin/accept-invite, not here.
  const isInvitePage = pathname === '/admin/accept-invite';

  if (isPublicAdminAsset || isInvitePage) return NextResponse.next();
  if (isApi && PUBLIC_ADMIN_API_PATHS.has(pathname)) return NextResponse.next();

  // Created up front because the Supabase client writes refreshed cookies onto
  // it as a side effect of getUser().
  const response = NextResponse.next({ request });
  const supabase = createMiddlewareAuthClient(request, response);

  const { data, error } = await supabase.auth.getUser();
  const user = error ? null : data.user;
  const isAdmin = user?.app_metadata?.admin === true;

  if (isLoginPage) {
    // Already signed in — no reason to show the form again.
    if (isAdmin) return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    return response;
  }

  if (!isAdmin) {
    // An API caller gets the same 401 body withAdminAuth would have returned,
    // so a client cannot tell which layer refused it — and adminFetch's
    // session-expiry handling keeps working either way. Redirecting would hand
    // a fetch() an HTML login page under a 200, which is far harder to debug.
    if (isApi) {
      const unauthorised = NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
      response.cookies.getAll().forEach((cookie) => unauthorised.cookies.set(cookie));
      return unauthorised;
    }

    const redirect = NextResponse.redirect(new URL('/admin/login', request.url));
    // Carry over anything getUser() rotated, so a half-refreshed session is
    // not left behind for the login page to trip over.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
