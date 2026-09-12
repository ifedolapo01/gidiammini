/**
 * SUPABASE layer — the credential behind `createAdminClient()`.
 *
 * PostgREST switches the executing Postgres role to whatever a JWT's `role`
 * claim names, the same mechanism that already makes anon and authenticated
 * work. Signing one naming `app_service` — a role granted the same table
 * access as service_role but, deliberately, not BYPASSRLS (see
 * supabase/migrations/20260911100000_store_dimension_and_scoping.sql) — is
 * what lets Postgres's store-scoping RLS policies apply to admin-server
 * traffic instead of being bypassed by it.
 *
 * Built by hand with node:crypto rather than a JWT library, in the same spirit
 * as bearer-token.ts: three lines of HMAC-SHA256 need no dependency. Minted
 * fresh per call — signing costs microseconds, so caching an unexpired token
 * would only be complexity with no measurable benefit.
 */
import { createHmac } from 'node:crypto';

const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

/** Long enough that clock skew between mint and use is never the failure,
 *  short enough that a leaked token is not a standing credential. */
const TOKEN_TTL_SECONDS = 300;

export function signAppServiceToken(): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET is not defined');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      role: 'app_service',
      iss: 'supabase',
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    })
  ).toString('base64url');

  const signature = createHmac('sha256', secret).update(`${HEADER}.${payload}`).digest('base64url');

  return `${HEADER}.${payload}.${signature}`;
}
