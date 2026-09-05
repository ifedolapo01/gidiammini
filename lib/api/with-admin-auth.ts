// lib/api/with-admin-auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminActor, type AdminActor } from '@/lib/api/admin-session';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { clientIdentifier } from '@/lib/api/rate-limit';
import { recordAudit, type AuditEntry, type AuditContext } from '@/lib/api/audit';
import { revalidateProductListings } from '@/lib/commerce/product-listing';
import { requiredPermission, denyForPermission } from '@/lib/api/admin-authorization';
import type { AdminPermission } from '@/lib/api/admin-roles';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/** What a handler can record about what it changed. Calling this replaces the
 * automatic entry with a more useful one; calling it more than once records
 * each entry, for a request that touches several things. */
export type AuditRecorder = (entry: AuditEntry) => void;

export interface AdminRouteContext {
  supabase: SupabaseClient<Database>;
  params: any;
  /** Who is making the request — a named admin now, not a shared login.
   * Available for handlers that need to attribute something themselves, e.g. a
   * note on an order. */
  actor: AdminActor;
  /** Describe what this request changed. See AuditRecorder. */
  audit: AuditRecorder;
}

type AdminRouteHandler = (request: NextRequest, ctx: AdminRouteContext) => Promise<NextResponse>;

export interface AdminRouteOptions {
  /** Overrides the permission the route table would infer from the path. For
   * the rare endpoint whose path does not describe what it touches — not a
   * way to opt out, since omitting it still means the table decides. */
  permission?: AdminPermission;
}

/** Methods that change something and therefore belong in the trail. */
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * A best-effort read of the request body for the automatic entry.
 *
 * Handlers call `request.json()` themselves, and a request body can only be
 * read once — so this clones first. A clone that fails (no body, not JSON, a
 * multipart upload) yields null rather than breaking the request.
 */
async function peekBody(request: NextRequest): Promise<unknown> {
  try {
    const clone = request.clone();
    const text = await clone.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Wraps an admin API route handler with authentication, role-based
 * authorisation, a shared service-role Supabase client, a standard
 * error-response shape, and the audit trail.
 *
 * Authorisation is here, not in the routes, for the same reason the audit is:
 * a rule each route has to remember to apply is a rule that a route added
 * later does not. The permission a request needs comes from the route table
 * (lib/api/admin-route-permissions.ts), so adding an endpoint governs it
 * automatically, and an endpoint nobody listed is refused rather than assumed
 * harmless.
 *
 * The audit is written here rather than in each route on purpose: a route that
 * has to remember to log is a route that eventually does not. Every mutating
 * request produces at least one entry — naming the method, path, actor, IP,
 * response status and the submitted body — even if the handler says nothing.
 * A handler that calls `ctx.audit(...)` gets its own richer entries instead,
 * with real before/after values.
 *
 * Cache invalidation is here for the same reason. The storefront listing is
 * cached under one tag, and a route that has to remember to invalidate it is a
 * route that eventually does not — which surfaces as "I edited the price and
 * the shop still shows the old one". Every successful admin mutation drops the
 * tag. That is broader than strictly necessary — a shipping-zone edit changes
 * no listing — but an admin write is rare and the cost of an unnecessary drop
 * is one uncached query, whereas the cost of a missed one is a shopkeeper who
 * does not trust the save button. Order writes genuinely do belong: they move
 * stock, and they change the best-selling ranking.
 */
export function withAdminAuth(handler: AdminRouteHandler, options: AdminRouteOptions = {}) {
  return async (request: NextRequest, routeCtx?: { params: any }) => {
    const actor = await getAdminActor();
    if (!actor) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const pathname = new URL(request.url).pathname;
    const method = request.method.toUpperCase();
    const permission = requiredPermission(method, pathname, options.permission);

    if (!actor.can(permission)) return denyForPermission(request, actor, permission);

    const shouldAudit = MUTATING.has(method);
    const entries: AuditEntry[] = [];
    const audit: AuditRecorder = (entry) => entries.push(entry);

    // Read before the handler consumes the body.
    const submitted = shouldAudit ? await peekBody(request) : null;

    const supabase = createAdminClient();
    let response: NextResponse;

    try {
      response = await handler(request, { supabase, params: routeCtx?.params, actor, audit });
    } catch (error: any) {
      console.error('Admin API error:', error);
      response = NextResponse.json(
        { success: false, error: 'Internal server error', details: error.message },
        { status: 500 }
      );
    }

    if (shouldAudit) {
      const context: AuditContext = {
        actorId: actor.id,
        actorEmail: actor.email,
        method,
        path: pathname,
        ip: clientIdentifier(request),
        statusCode: response.status,
      };

      // A failed request is still worth recording — an attempt to cancel an
      // order that errored is exactly the kind of thing someone later asks
      // about. The status code distinguishes them.
      const toWrite: AuditEntry[] = entries.length > 0
        ? entries
        : [{
            entityType: 'request',
            entityId: null,
            action: 'request',
            after: submitted,
          }];

      // Awaited, so the entry is durable before the response goes out. A lost
      // entry is a hole in the trail, which is the one thing it must not have.
      await Promise.all(toWrite.map((entry) => recordAudit(supabase, entry, context)));
    }

    // Only on success: a rejected write changed nothing, and dropping the cache
    // for it would just make the next shopper pay for the failure.
    if (shouldAudit && response.status < 400) {
      revalidateProductListings();
    }

    return response;
  };
}
