// app/api/admin/team/[userId]/route.ts — change a role, revoke access, restore
// it, or send the invitation again.
//
// One PATCH rather than four verbs: every one of these is "this row is now
// different", and splitting them would put the last-owner guard in four places.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { isAdminRole } from '@/lib/api/admin-roles';
import { findMember, updateMember, TeamError } from '@/lib/api/admin-team';
import { inviteAdminUser } from '@/lib/api/admin-invite';
import type { AuditAction } from '@/lib/api/audit';

/** Which of the three things this request is, for the audit entry. A role
 * change and a revocation are different events even though both are an UPDATE. */
function actionFor(changes: { role?: string; is_active?: boolean }): AuditAction {
  if (changes.is_active === false) return 'revoke';
  if (changes.is_active === true) return 'restore';
  return 'role_change';
}

export const PATCH = withAdminAuth(async (request, { supabase, actor, params, audit }) => {
  const { userId } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const existing = await findMember(supabase, userId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'That admin does not exist.' }, { status: 404 });
    }

    // Resending is not a change to the row, so it is handled before the rest.
    if (body?.resendInvite === true) {
      const invite = await inviteAdminUser(supabase, {
        email: existing.email,
        name: existing.name,
        role: isAdminRole(existing.role) ? existing.role : 'read_only',
        invitedByLabel: actor.name || actor.email,
      });

      audit({ entityType: 'admin_user', entityId: userId, action: 'invite', after: { resent: true } });

      return NextResponse.json({
        success: true,
        member: existing,
        emailSent: invite.emailSent,
        inviteUrl: invite.emailSent ? undefined : invite.inviteUrl,
        message: invite.emailSent
          ? `Invitation sent again to ${existing.email}.`
          : `Could not send the email (${invite.emailError}). Send them the link below.`,
      });
    }

    const changes: { role?: any; is_active?: boolean } = {};

    if (body?.role !== undefined) {
      if (!isAdminRole(body.role)) {
        return NextResponse.json({ success: false, error: 'Unknown role.' }, { status: 400 });
      }
      changes.role = body.role;
    }

    if (body?.is_active !== undefined) changes.is_active = Boolean(body.is_active);

    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ success: false, error: 'Nothing to change.' }, { status: 400 });
    }

    // Self-revocation is the one mistake with no way back from inside the
    // product. Demoting yourself is allowed if another owner remains — locking
    // yourself out entirely is not.
    if (userId === actor.id && changes.is_active === false) {
      return NextResponse.json(
        { success: false, error: 'You cannot revoke your own access. Ask another owner to do it.' },
        { status: 400 }
      );
    }

    const member = await updateMember(supabase, userId, changes);

    audit({
      entityType: 'admin_user',
      entityId: userId,
      action: actionFor(changes),
      before: { role: existing.role, is_active: existing.is_active },
      after: { role: member.role, is_active: member.is_active },
      reason: typeof body?.reason === 'string' ? body.reason : null,
    });

    return NextResponse.json({ success: true, member });
  } catch (error) {
    if (error instanceof TeamError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Could not update the admin:', error);
    return NextResponse.json({ success: false, error: 'Could not update the admin.' }, { status: 500 });
  }
});
