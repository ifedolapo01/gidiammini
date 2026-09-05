// app/api/admin/session/route.ts - who the browser is signed in as.
//
// Needed the moment admins stopped being one shared login: an operator has to
// be able to see which account they are acting under, because that name is now
// what the audit trail records against everything they do.
//
// Returns 200 with `admin: null` rather than 401 when nobody is signed in.
// A 401 here would be caught by useAdminSessionGuard and bounce the user to
// the login page, which is exactly wrong for a header widget that is allowed
// to render nothing.
import { NextResponse } from 'next/server';
import { getAdminActor } from '@/lib/api/admin-session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await getAdminActor();

  return NextResponse.json({
    success: true,
    admin: actor ? { id: actor.id, email: actor.email, name: actor.name, role: actor.role } : null,
  });
}
