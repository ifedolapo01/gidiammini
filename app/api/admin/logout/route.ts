// app/api/admin/logout/route.ts
//
// Records the sign-out before clearing the cookie, so the trail shows a session
// ending as well as beginning. Deliberately not wrapped in withAdminAuth: an
// expired or already-invalid token must still be able to log out, and returning
// 401 here would leave a stale cookie in the browser.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminActor } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { recordAudit } from '@/lib/api/audit';
import { clientIdentifier } from '@/lib/api/rate-limit';

export async function POST(request: NextRequest) {
  // Read the actor before the cookie goes, or there is nobody to attribute it
  // to. A null actor means the cookie was already invalid; the sign-out is
  // still recorded, just unattributed.
  const actor = await getAdminActor(request);

  await recordAudit(
    createAdminClient(),
    { entityType: 'admin_session', entityId: actor?.email ?? null, action: 'logout' },
    {
      actorEmail: actor?.email ?? null,
      method: 'POST',
      path: '/api/admin/logout',
      ip: clientIdentifier(request),
      statusCode: 200,
    }
  );

  const response = NextResponse.json({ success: true });

  // Clear the admin cookie
  response.cookies.delete('admin-token');

  return response;
}
