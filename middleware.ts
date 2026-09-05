// middleware.ts
//
// Two jobs on every /admin request:
//
//   1. Keep the Supabase session alive. getUser() refreshes an expired access
//      token and writes the rotated cookies onto the response — without this,
//      a tab left open overnight would 401 on its next action rather than
//      quietly carrying on.
//   2. Turn away anyone without an admin session, before the admin shell
//      renders.
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
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareAuthClient } from '@/lib/supabase/admin-auth-server';

export async function middleware(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname === '/admin/login';
  // The white-label favicon (app/admin/icon.tsx) must be publicly fetchable —
  // browsers request it unauthenticated, including from the login page itself.
  const isPublicAdminAsset = request.nextUrl.pathname === '/admin/icon';

  if (isPublicAdminAsset) return NextResponse.next();

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
    const redirect = NextResponse.redirect(new URL('/admin/login', request.url));
    // Carry over anything getUser() rotated, so a half-refreshed session is
    // not left behind for the login page to trip over.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: '/admin/:path*',
};
