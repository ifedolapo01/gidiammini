// app/api/admin/logout/route.ts
//
// Records the sign-out before ending the session, so the trail shows a session
// ending as well as beginning. Deliberately not wrapped in withAdminAuth: an
// expired or already-invalid session must still be able to log out, and
// returning 401 here would leave stale cookies in the browser.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminActor } from '@/lib/api/admin-session';
import { createAdminAuthClient } from '@/lib/supabase/admin-auth-server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { recordAudit } from '@/lib/api/audit';
import { clientIdentifier } from '@/lib/api/rate-limit';

export async function POST(request: NextRequest) {
  // Read the actor before the session goes, or there is nobody to attribute it
  // to. A null actor means the session was already invalid; the sign-out is
  // still recorded, just unattributed.
  const actor = await getAdminActor();

  await recordAudit(
    createAdminClient(),
    { entityType: 'admin_session', entityId: actor?.email ?? null, action: 'logout' },
    {
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      method: 'POST',
      path: '/api/admin/logout',
      ip: clientIdentifier(request),
      statusCode: 200,
    }
  );

  // signOut revokes the refresh token at Supabase and clears the session
  // cookies through the adapter — deleting the cookies alone would leave a
  // usable refresh token behind.
  const supabase = await createAdminAuthClient();
  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}
