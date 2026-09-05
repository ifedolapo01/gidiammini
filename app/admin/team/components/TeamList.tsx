/** ADMIN layer — the admin list, in whichever shape the screen has room for.
 *
 * Owns the loading, error and empty states so the page is left with the
 * heading, the invite button and the wiring between them.
 */
'use client';

import { Button, ErrorState, Skeleton } from '@/components/ui';
import type { AdminRole } from '@/lib/api/admin-roles';
import TeamTable from './TeamTable';
import TeamMemberCard from './TeamMemberCard';
import type { TeamMember } from '../hooks/useTeam';

interface TeamListProps {
  members: TeamMember[];
  loading: boolean;
  error: string;
  currentUserId: string | null;
  pendingId: string | null;
  canManage: boolean;
  onRetry: () => void;
  onRoleChange: (member: TeamMember, role: AdminRole) => void;
  onSetActive: (member: TeamMember, active: boolean) => void;
  onResend: (member: TeamMember) => void;
}

export default function TeamList({
  members,
  loading,
  error,
  currentUserId,
  pendingId,
  canManage,
  onRetry,
  onRoleChange,
  onSetActive,
  onResend,
}: TeamListProps) {
  if (loading && members.length === 0) {
    return (
      <div className="space-y-3 p-3 sm:p-4">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load the team"
        description={error}
        actions={
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        }
      />
    );
  }

  if (members.length === 0) {
    return (
      <p className="py-10 text-center text-body-sm text-text-secondary">
        Nobody has been given an admin account yet.
      </p>
    );
  }

  return (
    <>
      <TeamTable
        members={members}
        currentUserId={currentUserId}
        pendingId={pendingId}
        canManage={canManage}
        onRoleChange={onRoleChange}
        onSetActive={onSetActive}
        onResend={onResend}
      />

      <ul className="divide-y divide-divider md:hidden">
        {members.map((member) => (
          <TeamMemberCard
            key={member.user_id}
            member={member}
            currentUserId={currentUserId}
            busy={pendingId === member.user_id}
            canManage={canManage}
            onRoleChange={(role) => onRoleChange(member, role)}
            onSetActive={(active) => onSetActive(member, active)}
            onResend={() => onResend(member)}
          />
        ))}
      </ul>
    </>
  );
}
