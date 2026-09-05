// app/api/admin/team/route.ts — who the admins are, and inviting a new one.
//
// GET needs only 'team:read', which managers hold: the activity feed's "who"
// filter is built from this list, and a manager who cannot name their
// colleagues cannot use it. Changing the team needs 'team:manage', which only
// an owner holds. Both are declared in lib/api/admin-route-permissions.ts and
// enforced by withAdminAuth — this file states no rule of its own.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { isValidEmail } from '@/lib/validation';
import { isAdminRole } from '@/lib/api/admin-roles';
import { listTeam, findMemberByEmail, addMember, updateMember, TeamError } from '@/lib/api/admin-team';
import { inviteAdminUser } from '@/lib/api/admin-invite';

function failure(error: unknown) {
  if (error instanceof TeamError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error('Team request failed:', error);
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

export const GET = withAdminAuth(async (_request, { supabase }) => {
  try {
    return NextResponse.json({ success: true, members: await listTeam(supabase) });
  } catch (error) {
    return failure(error);
  }
});

export const POST = withAdminAuth(async (request, { supabase, actor, audit }) => {
  const body = await request.json().catch(() => ({}));

  const email = String(body?.email ?? '').trim().toLowerCase();
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : null;
  const role = body?.role;

  if (!isValidEmail(email)) {
    return NextResponse.json({ success: false, error: 'Enter a valid email address.' }, { status: 400 });
  }

  if (!isAdminRole(role)) {
    return NextResponse.json({ success: false, error: 'Choose a role for this person.' }, { status: 400 });
  }

  try {
    const existing = await findMemberByEmail(supabase, email);

    // An address already working here is not a new invitation. Saying so beats
    // silently resending, which would reset nothing and confuse both parties.
    if (existing?.is_active) {
      return NextResponse.json(
        { success: false, error: `${email} is already an admin. Change their role from the list instead.` },
        { status: 409 }
      );
    }

    const invite = await inviteAdminUser(supabase, {
      email,
      name,
      role,
      invitedByLabel: actor.name || actor.email,
    });

    // A returning colleague keeps their user_id, so the audit trail written
    // under their name before they left still resolves to them.
    const member = existing
      ? await updateMember(supabase, existing.user_id, { role, is_active: true, name })
      : await addMember(supabase, {
          userId: invite.userId,
          email,
          name,
          role,
          invitedBy: actor.id,
        });

    audit({
      entityType: 'admin_user',
      entityId: member.user_id,
      action: existing ? 'restore' : 'invite',
      before: existing ? { role: existing.role, is_active: existing.is_active } : null,
      after: { email, name, role, is_active: true },
    });

    return NextResponse.json({
      success: true,
      member,
      emailSent: invite.emailSent,
      // Handed back so a failed send is recoverable: the owner can pass the
      // link on themselves rather than being left with an account nobody can
      // reach.
      inviteUrl: invite.emailSent ? undefined : invite.inviteUrl,
      message: invite.emailSent
        ? `Invitation sent to ${email}.`
        : `Account created, but the email could not be sent (${invite.emailError}). Send them the link below.`,
    });
  } catch (error) {
    return failure(error);
  }
});
