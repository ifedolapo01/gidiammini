/** ADMIN layer — the controls on one admin: their role, and their access.
 *
 * Shared by the table and the card so the two cannot offer different actions.
 * Every control is disabled while that member has a request in flight, because
 * revoking somebody twice, or re-roling them mid-revoke, is a race an operator
 * should not be able to start.
 */
'use client';

import { Button, Spinner } from '@/components/ui';
import type { AdminRole } from '@/lib/api/admin-roles';
import RoleSelect from './RoleSelect';
import type { TeamMember } from '../hooks/useTeam';

interface TeamMemberActionsProps {
  member: TeamMember;
  /** The signed-in admin, so the UI can refuse to let them revoke themselves
   * before the server has to. */
  currentUserId: string | null;
  busy: boolean;
  onRoleChange: (role: AdminRole) => void;
  onSetActive: (active: boolean) => void;
  onResend: () => void;
}

export default function TeamMemberActions({
  member,
  currentUserId,
  busy,
  onRoleChange,
  onSetActive,
  onResend,
}: TeamMemberActionsProps) {
  const isSelf = member.user_id === currentUserId;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {busy && <Spinner size="sm" />}

      <div className="min-w-[9rem]">
        <RoleSelect
          id={`role-${member.user_id}`}
          value={member.role as AdminRole}
          onChange={onRoleChange}
          disabled={busy || !member.is_active}
          showDescription={false}
          aria-label={`Role for ${member.email}`}
        />
      </div>

      {member.is_active && member.pending && (
        <Button variant="outline" size="sm" disabled={busy} onClick={onResend}>
          Resend invite
        </Button>
      )}

      {member.is_active ? (
        <Button
          variant="outline"
          size="sm"
          disabled={busy || isSelf}
          // Spelled out rather than left to a tooltip: an owner who cannot
          // press the button deserves to know it is not broken.
          title={isSelf ? 'Ask another owner to revoke your access.' : undefined}
          onClick={() => onSetActive(false)}
        >
          Revoke
          <span className="sr-only"> access for {member.email}</span>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => onSetActive(true)}>
          Restore
          <span className="sr-only"> access for {member.email}</span>
        </Button>
      )}
    </div>
  );
}
