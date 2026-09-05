// app/api/admin/realtime-token/route.ts — the one token the browser is given.
//
// The admin's session lives in httpOnly cookies precisely so no script on the
// page can read it. But the realtime socket is opened by the browser, and
// Realtime authorises the subscription from a JWT, so something has to cross
// that line.
//
// What crosses is the ACCESS token only, never the refresh token: it is short
// lived (Supabase's configured access-token TTL, an hour by default), the
// client holds it in memory rather than in storage, and it grants exactly what
// the RLS policies in 20260905140100 allow — SELECT on a handful of non-
// identifying columns of `orders` and `product_variants`. It cannot read
// customer data and it cannot write anything.
//
// `expiresAt` is returned so the client can fetch a fresh one before the
// socket's token goes stale rather than discovering it through a dropped
// subscription.
import { NextResponse } from 'next/server';
import { getAdminActor } from '@/lib/api/admin-session';
import { createAdminAuthClient } from '@/lib/supabase/admin-auth-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // The allowlist check, not just "is signed in" — a deactivated admin must
  // stop being able to arm a socket immediately, not when their token expires.
  const actor = await getAdminActor();
  if (!actor) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createAdminAuthClient();
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    return NextResponse.json({ success: false, error: 'No active session' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    token: data.session.access_token,
    // Seconds since the epoch, as Supabase reports it.
    expiresAt: data.session.expires_at ?? null,
  });
}
