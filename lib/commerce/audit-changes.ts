/**
 * COMMERCE layer — rendering what an audit entry actually changed.
 *
 * Split from audit-format.ts, which holds the labels and tones. This half is
 * about the diff: which fields moved, how a value reads, and whether the entry
 * describes a failed attempt.
 *
 * Pure, so the wording is testable without a database or a browser.
 */
import type { AuditLogEntry } from './audit-format';

/** Title-cases a snake_case identifier, so a field or action this file has
 * never heard of still reads as words. Lives here rather than in audit-format
 * so imports run one way: audit-format depends on this module, not the reverse.
 */
export function humanise(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

/** How a single value reads in a diff row. */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value === '' ? '—' : value;
  // An object or array — show it compactly rather than as [object Object].
  try {
    const json = JSON.stringify(value);
    return json.length > 120 ? `${json.slice(0, 117)}…` : json;
  } catch {
    return String(value);
  }
}

/**
 * Bookkeeping columns that move on every save and are never what a reader
 * wants. `updated_at` in particular was showing as the headline change on a
 * product edit, next to a "When" column saying the same thing in a different
 * timezone. Filtered here as well as at write time, so entries recorded before
 * that fix read correctly too.
 */
const NEVER_SHOWN = ['updated_at', 'created_at'];

/**
 * The changed fields as before/after pairs, ready to render.
 *
 * Entries are sorted by field name so the same edit always reads the same way,
 * rather than in whatever order the database returned the JSON keys.
 */
export function fieldChanges(entry: Pick<AuditLogEntry, 'before' | 'after'>): FieldChange[] {
  const keys = new Set([...Object.keys(entry.before ?? {}), ...Object.keys(entry.after ?? {})]);

  return [...keys]
    .filter((field) => !NEVER_SHOWN.includes(field))
    .sort((a, b) => a.localeCompare(b))
    .map((field) => ({
      field: humanise(field),
      from: formatValue(entry.before?.[field]),
      to: formatValue(entry.after?.[field]),
    }));
}

/** True when the request this entry describes did not succeed. Failed attempts
 * are recorded deliberately — an attempt to cancel an order that errored is
 * exactly what someone asks about later — so the feed has to mark them. */
export function isFailedAttempt(entry: Pick<AuditLogEntry, 'status_code'>): boolean {
  return typeof entry.status_code === 'number' && entry.status_code >= 400;
}

/**
 * Actions whose own label already says the attempt failed.
 *
 * "Sign-in refused" followed by a second "Failed 401" badge said the same thing
 * twice. The status code still matters, so it moves to the detail view rather
 * than being dropped.
 */
const SELF_EVIDENT_FAILURES = ['login_failed', 'login_throttled', 'reject'];

export function needsFailureBadge(entry: Pick<AuditLogEntry, 'action' | 'status_code'>): boolean {
  return isFailedAttempt(entry) && !SELF_EVIDENT_FAILURES.includes(entry.action);
}

/**
 * The one-line version of what changed, for a table cell.
 *
 * A single change reads in full ("Stock 14 → 13"); several are counted, because
 * three stacked diffs in a cell is not something anyone scans. The detail view
 * has the breakdown.
 */
export function changeSummary(entry: Pick<AuditLogEntry, 'before' | 'after'>): string {
  const changes = fieldChanges(entry);

  if (changes.length === 0) return '—';
  if (changes.length === 1) {
    const [only] = changes;
    return `${only.field} ${only.from} → ${only.to}`;
  }

  return `${changes.length} fields changed`;
}
