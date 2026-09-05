/**
 * CORE layer — the authorisation half of withAdminAuth.
 *
 * Separated from the wrapper so that "is this admin allowed to do this" reads
 * as one thing in one place, and so with-admin-auth.ts stays about the request
 * lifecycle rather than about the rules.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { clientIdentifier } from '@/lib/api/rate-limit';
import { recordAudit } from '@/lib/api/audit';
import { permissionForRequest } from '@/lib/api/admin-route-permissions';
import type { AdminPermission } from '@/lib/api/admin-roles';
import type { AdminActor } from '@/lib/api/admin-session';

/**
 * The permission this request needs.
 *
 * Resolved from the route table rather than from an argument each route
 * supplies, because a check a route opts into is a check the next route
 * forgets. An endpoint the table does not list is refused to everyone but an
 * owner and logged loudly, so the gap surfaces in development instead of
 * becoming a silently unguarded endpoint in production.
 */
export function requiredPermission(
  method: string,
  pathname: string,
  override?: AdminPermission
): AdminPermission {
  if (override) return override;

  const { permission, listed } = permissionForRequest(method, pathname);
  if (!listed) {
    console.error(
      `No permission listed for ${method} ${pathname}; requiring '${permission}'. ` +
      'Add it to lib/api/admin-route-permissions.ts.'
    );
  }
  return permission;
}

/**
 * The 403, and the audit entry that goes with it.
 *
 * A refusal is recorded even though nothing changed: "who tried to cancel that
 * order" is worth answering about attempts as well as successes, and a run of
 * these is the only signal that somebody's role is set too narrow for the job
 * they are actually doing.
 */
export async function denyForPermission(
  request: NextRequest,
  actor: AdminActor,
  permission: AdminPermission
): Promise<NextResponse> {
  await recordAudit(
    createAdminClient(),
    { entityType: 'request', entityId: null, action: 'access_denied', after: { permission } },
    {
      actorId: actor.id,
      actorEmail: actor.email,
      method: request.method.toUpperCase(),
      path: new URL(request.url).pathname,
      ip: clientIdentifier(request),
      statusCode: 403,
    }
  );

  return NextResponse.json(
    {
      success: false,
      error: 'Your account does not have permission to do that.',
      // Named so the Admin can say which permission is missing rather than
      // only that something went wrong.
      permission,
    },
    { status: 403 }
  );
}
