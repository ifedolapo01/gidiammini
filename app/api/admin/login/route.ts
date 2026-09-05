// app/api/admin/login/route.ts
//
// Signs an admin in against Supabase Auth and leaves a real session in
// httpOnly cookies. It used to compare against ADMIN_EMAIL /
// ADMIN_PASSWORD_HASH and mint a custom HS256 cookie; that could only ever
// describe one shared login, and gave the browser no identity Realtime or RLS
// could act on.
//
// The throttling and the audit entries are unchanged. Supabase Auth has its
// own rate limits, but they are not ours to tune and they do not distinguish
// the two keys below, so this keeps its own:
//
//   * per IP      — the usual flood control
//   * per account — so rotating through IPs (trivial and cheap) doesn't
//                   multiply the number of guesses available
//
// Only FAILED attempts consume the per-account budget, and a success clears it,
// so an admin who mistypes their password a few times and then gets it right
// isn't left carrying those failures for the rest of the window.
//
// Both rules fail closed: if the rate limiter itself can't run, the login is
// refused. An unthrottled password guesser does real damage, and with the
// database down the admin can't do anything useful anyway.
import { NextRequest, NextResponse } from 'next/server';
import {
  checkRateLimit, resetRateLimit, rateLimitKey, clientIdentifier, tooManyRequests,
} from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { recordAudit, type AuditAction } from '@/lib/api/audit';
import { createAdminAuthClient } from '@/lib/supabase/admin-auth-server';

/**
 * Sign-in attempts go in the audit trail.
 *
 * This route cannot use withAdminAuth — nobody is authenticated yet, which is
 * the point of it — so it records its own entries. Refused and throttled
 * attempts matter more than successful ones: a run of them is what an attempted
 * break-in looks like, and it is the one thing an operator would want to see
 * without being told to look.
 *
 * The attempted email is recorded; the password never is. It is not passed to
 * recordAudit at all, so there is nothing for redaction to catch.
 */
async function recordSignIn(
  request: NextRequest,
  action: AuditAction,
  attemptedEmail: unknown,
  statusCode: number
): Promise<void> {
  const email = typeof attemptedEmail === 'string' ? attemptedEmail.trim().toLowerCase() : null;

  await recordAudit(
    createAdminClient(),
    { entityType: 'admin_session', entityId: email, action },
    {
      actorEmail: email,
      method: 'POST',
      path: '/api/admin/login',
      ip: clientIdentifier(request),
      statusCode,
    }
  );
}

const THROTTLED_MESSAGE = 'Too many sign-in attempts. Please wait 15 minutes and try again.';
/** Deliberately identical for a wrong email and a wrong password, so the
 * response can't be used to discover which admin address is valid. */
const INVALID_MESSAGE = 'Invalid credentials';

/** Normalised so 'Admin@X.com' and 'admin@x.com' share one attempt budget. */
function accountKey(email: unknown): string {
  const normalised = typeof email === 'string' ? email.trim().toLowerCase() : '';
  return rateLimitKey(RATE_LIMITS.loginPerAccount.bucket, normalised || 'unknown');
}

export async function POST(request: NextRequest) {
  try {
    const ipKey = rateLimitKey(RATE_LIMITS.loginPerIp.bucket, clientIdentifier(request));

    // Counted on every attempt, successful or not.
    const byIp = await checkRateLimit(ipKey, RATE_LIMITS.loginPerIp);
    if (!byIp.allowed) {
      console.warn(`Login throttled by IP: ${clientIdentifier(request)}`);
      await recordSignIn(request, 'login_throttled', null, 429);
      return tooManyRequests(byIp, THROTTLED_MESSAGE);
    }

    const { email, password } = await request.json();
    const accountLimitKey = accountKey(email);

    // Read the per-account budget without consuming it — failures below are
    // what spend it, so a legitimate admin's successful logins are free.
    const byAccount = await checkRateLimit(accountLimitKey, RATE_LIMITS.loginPerAccount, { count: false });
    if (!byAccount.allowed) {
      console.warn('Login throttled by account (too many recent failures)');
      await recordSignIn(request, 'login_throttled', email, 429);
      return tooManyRequests(byAccount, THROTTLED_MESSAGE);
    }

    // Supabase verifies the password. The session cookies are written through
    // the adapter in createAdminAuthClient, which sets them via next/headers —
    // Next attaches them to whatever this handler returns.
    const supabase = await createAdminAuthClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email ?? '').trim(),
      password: String(password ?? ''),
    });

    // An account that authenticates but is not on the allowlist is not an
    // admin. Signing it straight back out matters: leaving the session in
    // place would hand a non-admin a token the realtime endpoint would then be
    // asked to vouch for.
    const adminRow = data?.user
      ? await createAdminClient()
          .from('admin_users')
          .select('user_id, is_active')
          .eq('user_id', data.user.id)
          .maybeSingle()
      : null;

    const isActiveAdmin = Boolean(adminRow?.data?.is_active);

    if (error || !data?.user || !isActiveAdmin) {
      if (data?.user && !isActiveAdmin) await supabase.auth.signOut();

      // Only now spend a slot from the per-account budget.
      await checkRateLimit(accountLimitKey, RATE_LIMITS.loginPerAccount);
      await recordSignIn(request, 'login_failed', email, 401);
      return NextResponse.json({ success: false, error: INVALID_MESSAGE }, { status: 401 });
    }

    // Success: forget the earlier fumbles.
    await resetRateLimit(accountLimitKey);
    await recordSignIn(request, 'login', email, 200);

    // Last seen, so an admin list can show who is actually still using the
    // store. Best-effort — a failed timestamp must not fail a sign-in.
    await createAdminClient()
      .from('admin_users')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('user_id', data.user.id);

    return NextResponse.json({ success: true, message: 'Login successful' });
  } catch (error) {
    console.error('Login failed:', error);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}
