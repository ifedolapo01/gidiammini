/**
 * CORE layer — creating and delivering an admin invitation.
 *
 * WHY NOT supabase.auth.admin.inviteUserByEmail
 *
 * That sends through Supabase's own mailer, which is a second email
 * configuration to keep working and which is rate-limited to a handful of
 * messages an hour on the default project. More importantly its link lands on
 * a page with the session in the URL fragment, and this app deliberately keeps
 * admin sessions in httpOnly cookies the browser cannot read (see
 * lib/supabase/admin-auth-server.ts). Accepting a session through the fragment
 * would undo that.
 *
 * So the token is generated without sending anything, delivered by this app's
 * own SMTP transport, and redeemed server-side at /api/admin/accept-invite,
 * which exchanges it for the same httpOnly cookies a password sign-in produces.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/lib/site-url';
import { sendOrderEmail } from '@/lib/email';
import { buildAdminInviteEmail } from '@/lib/notifications/templates/admin-invite-email';
import { ADMIN_ROLE_INFO, type AdminRole } from './admin-roles';

/** Named so a caller can tell "the account exists but the email bounced" from
 * "nothing happened at all" — the first still needs the link passing on. */
export interface InviteResult {
  userId: string;
  /** Where the invitee must go to set a password. Returned to the inviter so a
   * failed send is recoverable by hand rather than a dead end. */
  inviteUrl: string;
  emailSent: boolean;
  emailError?: string;
}

/** The store's name in the invitation. A literal, as in every other template
 * in lib/notifications/templates — not imported from the Admin's white-label
 * config, which this layer must not depend on. */
const STORE_NAME = 'GidiamMini';

/**
 * The auth user behind an invitation, created if this address has never had one.
 *
 * `generateLink` with type 'invite' creates the user and mints a token in one
 * call, but refuses an address that already exists — which is the case when a
 * previous admin is being brought back, or when somebody is a customer of the
 * shop as well. 'recovery' produces an equivalent set-a-password token for a
 * user that is already there.
 */
async function generateInviteToken(
  supabase: SupabaseClient,
  email: string,
  name: string | null
): Promise<{ userId: string; tokenHash: string; tokenType: 'invite' | 'recovery' }> {
  const invite = await supabase.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { data: name ? { name } : undefined },
  });

  const usable = invite.data?.user && invite.data.properties?.hashed_token;
  if (usable) {
    return {
      userId: invite.data.user!.id,
      tokenHash: invite.data.properties!.hashed_token,
      tokenType: 'invite',
    };
  }

  const recovery = await supabase.auth.admin.generateLink({ type: 'recovery', email });

  if (!recovery.data?.user || !recovery.data.properties?.hashed_token) {
    throw new Error(
      recovery.error?.message || invite.error?.message || 'Could not create an invitation link.'
    );
  }

  return {
    userId: recovery.data.user.id,
    tokenHash: recovery.data.properties.hashed_token,
    tokenType: 'recovery',
  };
}

/**
 * Creates the auth user, marks it as an admin, and emails the invitation.
 *
 * The `admin` app_metadata claim is what middleware reads on every admin page
 * request. It is not the authority on who may do what — public.admin_users is,
 * checked live on every API call — but without it the invitee would be bounced
 * back to the login page by middleware before any of that ran.
 */
export async function inviteAdminUser(
  supabase: SupabaseClient,
  params: { email: string; name: string | null; role: AdminRole; invitedByLabel: string | null }
): Promise<InviteResult> {
  const { email, name, role, invitedByLabel } = params;

  const { userId, tokenHash, tokenType } = await generateInviteToken(supabase, email, name);

  const { error: metadataError } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { admin: true },
  });
  if (metadataError) {
    throw new Error(`Could not mark the account as an admin: ${metadataError.message}`);
  }

  // The type travels with the token because redeeming it has to name which
  // kind it is, and only this function knows which one was minted.
  const inviteUrl =
    `${SITE_URL}/admin/accept-invite?token=${encodeURIComponent(tokenHash)}&type=${tokenType}`;
  const info = ADMIN_ROLE_INFO.find((r) => r.value === role);

  const { subject, html } = buildAdminInviteEmail({
    name,
    invitedBy: invitedByLabel,
    roleLabel: info?.label ?? role,
    roleDescription: info?.description ?? '',
    storeName: STORE_NAME,
    inviteUrl,
  });

  const sent = await sendOrderEmail(email, subject, html);

  return {
    userId,
    inviteUrl,
    emailSent: sent.success,
    emailError: sent.success ? undefined : sent.detail,
  };
}
