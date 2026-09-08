/**
 * CORE layer — turns a client-generated anon id into an opaque session key.
 *
 * The storefront event tracker holds a random id in sessionStorage so it can
 * group one visit's events together (see lib/commerce/storefront-events.ts).
 * That raw id never reaches the database: HMAC-SHA256 with a server-only
 * secret means storefront_events.session_id can group rows from one session
 * without storing anything that maps back to a browser — the NDPR-friendlier
 * property the feature is for.
 */
import { createHmac } from 'crypto';

// Falls back to a fixed string rather than throwing, so a store that has not
// set this yet gets a working (if less rotation-resistant) hash instead of a
// broken events pipeline. Set EVENTS_HASH_SECRET in production.
const SECRET = process.env.EVENTS_HASH_SECRET || 'gidiammini-storefront-events-default-secret';

export function hashSessionId(rawId: string): string {
  return createHmac('sha256', SECRET).update(rawId).digest('hex');
}
