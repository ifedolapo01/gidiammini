/**
 * Who is making an admin request.
 *
 * Replaces the env-var credential and custom HS256 cookie that lib/auth.ts
 * used to implement. The session is now a real Supabase Auth session, and the
 * actor is a row in public.admin_users — which is what lets audit_log finally
 * name a person rather than a shared mailbox.
 *
 * TWO CHECKS, DELIBERATELY
 *
 *   1. The access token is genuinely Supabase's and names a user.
 *   2. public.admin_users says that user is still an active admin.
 *
 * The second is not redundant. A JWT claim only changes when a token refreshes,
 * so revoking somebody by claim alone would leave them working for up to an
 * access token's lifetime. Reading the row costs one indexed lookup per admin
 * API request — admin traffic is low, and "removed access takes effect now" is
 * worth more than that.
 *
 * The first is done locally where it can be. The admin polls for changes every
 * few seconds, and a getUser() round-trip on each of those is latency spent
 * proving something a signature check already proves. getUser() remains the
 * fallback for anything verify-supabase-jwt.ts declines to judge.
 *
 * Server-only: uses next/headers, so it must never be imported by middleware.
 * Middleware does its own, cheaper check — see middleware.ts.
 */
import 'server-only';
import { createAdminAuthClient } from '@/lib/supabase/admin-auth-server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifySupabaseAccessToken } from './verify-supabase-jwt';

/** Who is making the request. */
export interface AdminActor {
  /** auth.users.id — what lands in audit_log.actor_id. */
  id: string;
  email: string | null;
  /** Display name, when one was recorded. */
  name: string | null;
  /** 'owner' | 'staff'. */
  role: string;
}

/**
 * The auth.users id behind this request, or null.
 *
 * getSession() reads the cookie and refreshes an expired token, but does not
 * prove the token is real — so the signature is checked here before the `sub`
 * is believed. Where that check cannot be made (no JWT secret configured, or a
 * project using asymmetric signing keys), getUser() asks the auth server, which
 * is slower and always correct.
 */
async function authenticatedUserId(): Promise<string | null> {
  const supabase = await createAdminAuthClient();

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (token) {
    const check = await verifySupabaseAccessToken(token);
    if (check.status === 'valid') return check.sub;
    if (check.status === 'invalid') return null;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

/** The signed-in admin, or null. */
export async function getAdminActor(): Promise<AdminActor | null> {
  const userId = await authenticatedUserId();
  if (!userId) return null;

  // Service role, because admin_users is readable by nobody else — the browser
  // has no business reading the allowlist it is being checked against.
  const { data: admin, error: lookupError } = await createAdminClient()
    .from('admin_users')
    .select('user_id, email, name, role, is_active')
    .eq('user_id', userId)
    .maybeSingle();

  if (lookupError) {
    // Fail closed. An admin table that cannot be read is not permission to
    // assume everybody is an admin.
    console.error('Could not read admin_users; refusing the request:', lookupError.message);
    return null;
  }

  if (!admin || !admin.is_active) return null;

  return {
    id: admin.user_id,
    email: admin.email ?? null,
    name: admin.name ?? null,
    role: admin.role,
  };
}

/** True when the caller is a signed-in, active admin. */
export async function isAdminRequest(): Promise<boolean> {
  return (await getAdminActor()) !== null;
}
