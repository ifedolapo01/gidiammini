/**
 * COMMERCE layer — turning an audit entry into something a person can read.
 *
 * A raw entry is `{action: 'stock_change', entity_type: 'product_variant',
 * entity_id: 'uuid:3-5 months|Yellow', before: {stock: 12}, after: {stock: 3}}`.
 * Nobody scans a feed of that. This produces "Stock changed" with a tone, a
 * readable entity name, and the changed fields as `12 → 3` pairs.
 *
 * Pure, so the wording is testable without a database or a browser.
 */
import type { BadgeTone } from '@/components/ui';

// Re-exported so a component needs one import for the whole audit surface.
import { humanise } from './audit-changes';

export {
  fieldChanges,
  changeSummary,
  isFailedAttempt,
  needsFailureBadge,
  type FieldChange,
} from './audit-changes';

export interface AuditLogEntry {
  id: string;
  actor_email: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  method: string | null;
  path: string | null;
  ip: string | null;
  status_code: number | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  status_change: 'Status changed',
  stock_change: 'Stock changed',
  shipping_change: 'Shipping changed',
  notify: 'Notified customer',
  block: 'Blocked',
  unblock: 'Unblocked',
  approve: 'Approved',
  reject: 'Rejected',
  invite: 'Invited',
  role_change: 'Role changed',
  revoke: 'Access revoked',
  restore: 'Access restored',
  access_denied: 'Refused',
  export: 'Exported',
  login: 'Signed in',
  login_failed: 'Sign-in failed',
  login_throttled: 'Sign-in throttled',
  logout: 'Signed out',
  request: 'Request',
};

const ACTION_TONES: Record<string, BadgeTone> = {
  create: 'success',
  update: 'info',
  delete: 'destructive',
  status_change: 'primary',
  stock_change: 'warning',
  shipping_change: 'warning',
  notify: 'info',
  block: 'destructive',
  unblock: 'success',
  approve: 'success',
  reject: 'destructive',
  invite: 'info',
  role_change: 'warning',
  revoke: 'destructive',
  restore: 'success',
  // Not a failure of the system, but the thing in the feed most likely to
  // want a second look.
  access_denied: 'warning',
  export: 'info',
  login: 'success',
  login_failed: 'destructive',
  login_throttled: 'warning',
  logout: 'neutral',
  request: 'neutral',
};

const ENTITY_LABELS: Record<string, string> = {
  product: 'Product',
  product_variant: 'Variant',
  order: 'Order',
  order_change_request: 'Change request',
  discount: 'Discount',
  shipping_zone: 'Shipping zone',
  category: 'Category',
  subcategory: 'Subcategory',
  customer: 'Customer',
  subscriber: 'Subscriber',
  admin_user: 'Admin account',
  admin_session: 'Admin session',
  request: 'Admin request',
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? humanise(action);
}

export function actionTone(action: string): BadgeTone {
  return ACTION_TONES[action] ?? 'neutral';
}

export function entityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? humanise(entityType);
}

/**
 * Who did it.
 *
 * Now that admins are named, this is a person rather than a shared mailbox.
 * 'System' rather than 'Unknown admin' where there is no address: an entry
 * with no actor was written by something automatic (a sweep, a webhook), not
 * by somebody the trail failed to identify.
 */
export function actorLabel(entry: Pick<AuditLogEntry, 'actor_email'>): string {
  return entry.actor_email || 'System';
}

/**
 * A short identifier for the entity, for a feed row.
 *
 * A variant's entity_id is `<product uuid>:<variant key>`; showing the whole
 * thing is noise, and showing only the uuid tells the reader nothing. The
 * variant key is the informative half.
 */
export function entityShortId(entry: Pick<AuditLogEntry, 'entity_type' | 'entity_id'>): string {
  const id = entry.entity_id;
  if (!id) return '—';

  if (entry.entity_type === 'product_variant' && id.includes(':')) {
    return id.slice(id.indexOf(':') + 1);
  }

  // A bare uuid is unreadable in full and unambiguous in its first segment.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id) ? id.slice(0, 8) : id;
}

/** One-line summary for a collapsed feed row: "Stock changed · Variant 3-5 months|Yellow". */
export function summarise(entry: AuditLogEntry): string {
  return `${actionLabel(entry.action)} · ${entityLabel(entry.entity_type)} ${entityShortId(entry)}`.trim();
}
