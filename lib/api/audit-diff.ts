/**
 * CORE layer — redaction and diffing for the audit trail. Pure.
 *
 * Split from audit.ts so the rules about what may be written and how a change
 * is summarised can be read and tested without the database write beside them.
 * Re-exported from audit.ts, so callers keep one import.
 */

/**
 * Field names whose values are never written to the log. Matched as a
 * substring against the lower-cased key, so `apiKey`, `API_KEY` and
 * `stripe_secret_key` are all caught by the same entries.
 */
const REDACTED_KEYS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'jwt',
  'receipt_path',
  'idempotency_key',
];

const REDACTED = '[redacted]';

/** How deep to walk a value before giving up. Guards against a cyclic or
 * pathologically nested body turning one log write into a hang. */
const MAX_DEPTH = 6;

export function isRedactedKey(key: string): boolean {
  const lower = key.toLowerCase().replace(/[-_]/g, '');
  return REDACTED_KEYS.some((needle) => lower.includes(needle.replace(/[-_]/g, '')));
}

/** Recursively replaces secret-looking values. Returns a plain JSON-safe value. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (depth >= MAX_DEPTH) return '[truncated]';

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  // Before the plain-object branch: a Date has no own enumerable properties,
  // so walking it as an object yields {} and loses the timestamp entirely.
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    // Any other class instance would also flatten to {}. Describing it is less
    // wrong than recording an empty object as if the field held nothing.
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return String(value);
    }

    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isRedactedKey(key) ? REDACTED : redact(inner, depth + 1);
    }
    return out;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  // Dates, Maps, anything exotic — describe rather than serialise badly.
  return String(value);
}

/**
 * The fields that actually changed, as a pair of before/after objects.
 *
 * Storing whole rows twice makes an entry unreadable: the reader has to spot
 * the one different number among thirty identical ones. Keys present in only
 * one side are included, so an added or removed field still shows.
 */
export function diffForAudit(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  for (const key of keys) {
    const from = before?.[key];
    const to = after?.[key];

    // JSON comparison, so nested objects (pricing_config) compare by value.
    if (JSON.stringify(from ?? null) === JSON.stringify(to ?? null)) continue;

    // The key has to be tested here. redact() decides by key name, and passing
    // it a bare value gives it nothing to decide on — which meant a changed
    // password was previously written to the log in clear.
    if (isRedactedKey(key)) {
      changedBefore[key] = REDACTED;
      changedAfter[key] = REDACTED;
      continue;
    }

    changedBefore[key] = redact(from);
    changedAfter[key] = redact(to);
  }

  return { before: changedBefore, after: changedAfter };
}

/**
 * Drops the bookkeeping timestamps from a diff.
 *
 * `updated_at` moves on every save, so without this a form opened and saved
 * with no edits still produces a feed entry reading "updated_at: then → now" —
 * which tells a reader nothing and buries the changes that matter.
 */
export function withoutTimestamps(diff: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const drop = ['updated_at', 'created_at'];
  const strip = (fields: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(fields).filter(([key]) => !drop.includes(key)));

  return { before: strip(diff.before), after: strip(diff.after) };
}

/** True when a diff found nothing — a save that changed nothing at all. */
export function isEmptyDiff(diff: { before: object; after: object }): boolean {
  return Object.keys(diff.after).length === 0 && Object.keys(diff.before).length === 0;
}
