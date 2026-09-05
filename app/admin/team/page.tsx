/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/team/page.tsx — who can get into this admin, and what they can do
// once they are in.
//
// The screen that makes the audit trail mean something: entries name a person
// only because people have their own accounts, and an account can be given,
// narrowed and taken away from here rather than by editing an environment
// variable and redeploying.
'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui';
import { can, type AdminRole } from '@/lib/api/admin-roles';
import { useAdminIdentity } from '../hooks/useAdminIdentity';
import { useToast } from '../hooks/useToast';
import InviteAdminForm from './components/InviteAdminForm';
import InviteLinkNotice from './components/InviteLinkNotice';
import TeamList from './components/TeamList';
import { useTeam, type InviteInput, type TeamActionResult, type TeamMember } from './hooks/useTeam';

export default function TeamPage() {
  const { admin } = useAdminIdentity();
  const { members, loading, error, pendingId, inviting, reload, invite, update } = useTeam();
  const { showToast } = useToast();

  const [inviteOpen, setInviteOpen] = useState(false);
  /** Set only when an invitation was created but the email did not go out. */
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  const canManage = can(admin?.role, 'team:manage');

  /** Every mutation reports the same way, so the page has one place that
   * toasts, and one place that surfaces an undeliverable invitation. */
  function report(result: TeamActionResult): TeamActionResult {
    showToast(result.message, result.ok ? 'success' : 'error');
    if (result.inviteUrl) setFallbackUrl(result.inviteUrl);
    return result;
  }

  async function handleInvite(input: InviteInput) {
    return report(await invite(input));
  }

  async function handleRoleChange(member: TeamMember, role: AdminRole) {
    if (role === member.role) return;
    report(await update(member.user_id, { role }));
  }

  async function handleSetActive(member: TeamMember, active: boolean) {
    report(await update(member.user_id, { is_active: active }));
  }

  async function handleResend(member: TeamMember) {
    report(await update(member.user_id, { resendInvite: true }));
  }

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-body-lg font-bold text-text-primary sm:text-h5 md:text-h4">Team</h1>
          <p className="mt-1 text-caption-md text-text-secondary sm:text-body-sm">
            {canManage
              ? 'Everyone who can get into this admin. Each person signs in as themselves, and everything they do is recorded under their name.'
              : 'Everyone who can get into this admin. Only an owner can change this list.'}
          </p>
        </div>

        {canManage && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" aria-hidden="true" />
            Invite an admin
          </Button>
        )}
      </header>

      {fallbackUrl && (
        <InviteLinkNotice url={fallbackUrl} onDismiss={() => setFallbackUrl(null)} />
      )}

      <div className="overflow-hidden rounded-surface border border-border bg-surface">
        <TeamList
          members={members}
          loading={loading}
          error={error}
          currentUserId={admin?.id ?? null}
          pendingId={pendingId}
          canManage={canManage}
          onRetry={reload}
          onRoleChange={handleRoleChange}
          onSetActive={handleSetActive}
          onResend={handleResend}
        />
      </div>

      <InviteAdminForm
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={handleInvite}
        submitting={inviting}
      />
    </div>
  );
}
