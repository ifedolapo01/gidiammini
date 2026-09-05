// app/api/admin/accept-invite/route.ts — turns an invitation token into an
// admin session with a password on it.
//
// Unauthenticated by necessity: the token is the credential, which is the whole
// point of an invitation. It is redeemed server-side so the resulting session
// lands in the same httpOnly cookies a password sign-in produces, rather than
// in a URL fragment the browser can read — see lib/api/admin-invite.ts.
//
// Three things happen, in this order and no other:
//
//   1. the token is exchanged for a session, proving control of the inbox,
//   2. public.admin_users is checked, because a valid Supabase token proves
//      an identity and says nothing about whether that identity is an admin,
//   3. the password is set.
//
// Getting (2) wrong would let anyone with a recovery token for any account in
// the project — a customer, say — walk into the admin.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminAuthClient } from '@/lib/supabase/admin-auth-server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { recordAudit } from '@/lib/api/audit';
import {
  checkRateLimit, clientIdentifier, rateLimitKey, tooManyRequests,
} from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';

/** Long enough that it cannot be guessed, short of a policy nobody follows.
 * The account it protects can read every customer's address. */
const MIN_PASSWORD_LENGTH = 10;

const INVALID = 'This invitation link is no longer valid. Ask an owner to send a new one.';

export async function POST(request: NextRequest) {
  const limitKey = rateLimitKey(RATE_LIMITS.adminInviteAccept.bucket, clientIdentifier(request));
  const limit = await checkRateLimit(limitKey, RATE_LIMITS.adminInviteAccept);
  if (!limit.allowed) {
    return tooManyRequests(limit, 'Too many attempts. Please wait and try again.');
  }

  const body = await request.json().catch(() => ({}));
  const token = String(body?.token ?? '').trim();
  const password = String(body?.password ?? '');
  const type = body?.type === 'recovery' ? 'recovery' : 'invite';

  if (!token) {
    return NextResponse.json({ success: false, error: INVALID }, { status: 400 });
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { success: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const supabase = await createAdminAuthClient();

  // 1. The token, exchanged for a session. Writes the auth cookies.
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: token, type });

  if (error || !data.user) {
    console.warn(`Invitation could not be redeemed: ${error?.message ?? 'no user'}`);
    return NextResponse.json({ success: false, error: INVALID }, { status: 400 });
  }

  // 2. Being a real Supabase user is not being an admin.
  const service = createAdminClient();
  const { data: admin } = await service
    .from('admin_users')
    .select('user_id, email, is_active')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (!admin?.is_active) {
    await supabase.auth.signOut();
    return NextResponse.json({ success: false, error: INVALID }, { status: 403 });
  }

  // 3. The password. Done last so a failure here leaves no half-made admin.
  const { error: passwordError } = await supabase.auth.updateUser({ password });

  if (passwordError) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { success: false, error: `Could not set that password: ${passwordError.message}` },
      { status: 400 }
    );
  }

  // Accepting is a sign-in, and it is the moment an invitation stops being
  // pending — both of which the team list and the activity feed read.
  await service
    .from('admin_users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('user_id', data.user.id);

  await recordAudit(
    service,
    { entityType: 'admin_session', entityId: admin.email, action: 'login', after: { accepted_invitation: true } },
    {
      actorId: data.user.id,
      actorEmail: admin.email,
      method: 'POST',
      path: '/api/admin/accept-invite',
      ip: clientIdentifier(request),
      statusCode: 200,
    }
  );

  return NextResponse.json({ success: true, message: 'Your account is ready.' });
}
