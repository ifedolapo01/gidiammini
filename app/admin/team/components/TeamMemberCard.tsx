/** ADMIN layer — one admin as a stacked card, for narrow screens.
 *
 * The narrow counterpart to TeamTable. A four-column table with a dropdown and
 * two buttons in the last cell does not survive a phone.
 */
'use client';

import { formatDate } from '@/lib/commerce/format-date';
import { roleLabel, type AdminRole } from '@/lib/api/admin-roles';
import TeamMemberActions from './TeamMemberActions';
import TeamMemberStatus from './TeamMemberStatus';
import type { TeamMember } from '../hooks/useTeam';

interface TeamMemberCardProps {
  member: TeamMember;
  currentUserId: string | null;
  busy: boolean;
  /** See TeamTable — a manager reads the list, an owner changes it. */
  canManage: boolean;
  onRoleChange: (role: AdminRole) => void;
  onSetActive: (active: boolean) => void;
  onResend: () => void;
}

export default function TeamMemberCard({
  member,
  currentUserId,
  busy,
  canManage,
  onRoleChange,
  onSetActive,
  onResend,
}: TeamMemberCardProps) {
  return (
    <li className={`px-3 py-4 sm:px-4 ${member.is_active ? '' : 'opacity-70'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-body-sm font-medium text-text-primary">
            {member.name || member.email}
            {member.user_id === currentUserId && (
              <span className="ml-2 text-caption-md font-normal text-text-secondary">(you)</span>
            )}
          </p>
          {member.name && (
            <p className="truncate text-caption-md text-text-secondary">{member.email}</p>
          )}
        </div>

        <TeamMemberStatus member={member} />
      </div>

      <p className="mt-1 text-caption-md text-text-muted">
        {roleLabel(member.role)} · added {formatDate(member.created_at)}
      </p>

      {canManage && (
        <div className="mt-3">
          <TeamMemberActions
            member={member}
            currentUserId={currentUserId}
            busy={busy}
            onRoleChange={onRoleChange}
            onSetActive={onSetActive}
            onResend={onResend}
          />
        </div>
      )}
    </li>
  );
}
