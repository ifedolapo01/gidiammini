/**
 * CORE layer — writing the audit trail.
 *
 * The point of this module is that recording an admin action is not something a
 * route has to remember. withAdminAuth writes an entry for every mutating
 * request whether the handler asks for one or not, so a route added next year
 * by someone who has never read this file is still covered. Handlers that can
 * say something more useful — the old and new price, the reason a refund was
 * given — call `audit()` and their richer entry replaces the generic one.
 *
 * Two rules:
 *
 *   1. Auditing never fails the action. If the log write errors, the action it
 *      describes has already happened; failing the request would be worse than
 *      an incomplete trail. Errors are logged loudly instead.
 *   2. Secrets never reach the log. Request bodies are recorded automatically,
 *      so anything password-shaped is redacted on the way in rather than
 *      trusted not to appear.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { redact } from './audit-diff';

// Re-exported so a route needs one import for the whole audit surface.
export { redact, diffForAudit, isEmptyDiff, withoutTimestamps } from './audit-diff';

/** Entities worth a history. Free-form by design — a new one needs no migration. */
export type AuditEntityType =
  | 'product'
  | 'product_variant'
  | 'product_review'
  | 'product_question'
  | 'order'
  | 'order_change_request'
  | 'discount'
  | 'shipping_zone'
  | 'category'
  | 'subcategory'
  | 'customer'
  | 'subscriber'
  /** An admin sign-in or sign-out. Not a row in any table — the entity is the
   * session itself. */
  | 'admin_session'
  | 'request';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'stock_change'
  | 'shipping_change'
  | 'notify'
  | 'block'
  | 'unblock'
  | 'approve'
  | 'reject'
  | 'login'
  /** A rejected sign-in. The most security-relevant thing this table holds:
   * a run of these is what an attempted break-in looks like. */
  | 'login_failed'
  | 'login_throttled'
  | 'logout'
  /** The automatic fallback, when a route did not describe itself. */
  | 'request';

export interface AuditEntry {
  entityType: AuditEntityType;
  entityId?: string | null;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

export interface AuditContext {
  actorEmail: string | null;
  method: string;
  path: string;
  ip: string | null;
  statusCode?: number;
}

/**
 * The row an audit entry is about to describe, read before it changes.
 *
 * An update overwrites the only copy of the old values and a hard delete
 * removes them entirely, so "what was it before" is unanswerable unless
 * something looks first. Returns null rather than throwing — a missing row is
 * the route's problem to report, not the audit trail's.
 */
export async function readForAudit(
  supabase: SupabaseClient,
  table: string,
  id: string,
  columns = '*'
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.from(table).select(columns).eq('id', id).maybeSingle();

  if (error) {
    console.error(`Audit pre-read of ${table}/${id} failed: ${error.message}`);
    return null;
  }

  // Through unknown: `columns` is a runtime string, so the typed client cannot
  // infer a row shape from it and widens to its error type.
  return (data as unknown as Record<string, unknown>) ?? null;
}

/**
 * Writes one entry. Never throws.
 *
 * Deliberately not awaited by callers that are on a response path — see
 * withAdminAuth, which awaits it so the entry is durable before the response
 * goes out. A lost entry is a hole in the trail, which is the one thing an
 * audit log must not have.
 */
export async function recordAudit(
  supabase: SupabaseClient,
  entry: AuditEntry,
  context: AuditContext
): Promise<void> {
  try {
    const { error } = await supabase.from('audit_log').insert({
      actor_email: context.actorEmail,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      action: entry.action,
      before: entry.before === undefined ? null : redact(entry.before),
      after: entry.after === undefined ? null : redact(entry.after),
      reason: entry.reason ?? null,
      method: context.method,
      path: context.path,
      ip: context.ip,
      status_code: context.statusCode ?? null,
    });

    if (error) {
      // Includes the case where the migration has not been applied yet.
      console.error(
        `AUDIT WRITE FAILED (${entry.action} ${entry.entityType} ${entry.entityId ?? ''}): ${error.message}`
      );
    }
  } catch (error: any) {
    console.error(`AUDIT WRITE THREW (${entry.action} ${entry.entityType}): ${error?.message}`);
  }
}
