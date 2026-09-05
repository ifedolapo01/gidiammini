/** ADMIN layer — the admin list as a table, for screens wide enough for one.
 *
 * Paired with TeamMemberCard, which renders the same data stacked on narrow
 * screens. Both hand their controls to TeamMemberActions.
 */
'use client';

import { formatDate } from '@/lib/commerce/format-date';
import { roleLabel, type AdminRole } from '@/lib/api/admin-roles';
import TeamMemberActions from './TeamMemberActions';
import TeamMemberStatus from './TeamMemberStatus';
import type { TeamMember } from '../hooks/useTeam';

const TH = 'px-4 py-3 text-left text-caption-md font-medium text-text-secondary uppercase tracking-wider whitespace-nowrap';
const TD = 'px-4 py-3 align-middle';

interface TeamTableProps {
  members: TeamMember[];
  currentUserId: string | null;
  pendingId: string | null;
  /** Managers may see the team — the activity feed's "who" filter is built
   * from it — but only an owner may change it. Without this they would be
   * shown controls every one of which returns 403. */
  canManage: boolean;
  onRoleChange: (member: TeamMember, role: AdminRole) => void;
  onSetActive: (member: TeamMember, active: boolean) => void;
  onResend: (member: TeamMember) => void;
}

export default function TeamTable({
  members,
  currentUserId,
  pendingId,
  canManage,
  onRoleChange,
  onSetActive,
  onResend,
}: TeamTableProps) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="min-w-full divide-y divide-divider">
        <caption className="sr-only">
          Everyone with access to this admin, active accounts first.
        </caption>
        <thead className="bg-background-secondary">
          <tr>
            <th scope="col" className={TH}>Person</th>
            <th scope="col" className={TH}>Status</th>
            <th scope="col" className={TH}>Added</th>
            <th scope="col" className={`${TH} text-right`}>
              {canManage ? 'Role and access' : 'Role'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {members.map((member) => (
            <tr key={member.user_id} className={member.is_active ? undefined : 'opacity-70'}>
              <td className={TD}>
                <span className="block text-body-sm font-medium text-text-primary">
                  {member.name || member.email}
                  {member.user_id === currentUserId && (
                    <span className="ml-2 text-caption-md font-normal text-text-secondary">(you)</span>
                  )}
                </span>
                {member.name && (
                  <span className="block text-caption-md text-text-secondary">{member.email}</span>
                )}
              </td>

              <td className={TD}>
                <TeamMemberStatus member={member} />
              </td>

              <td className={`${TD} whitespace-nowrap text-caption-md text-text-secondary`}>
                {formatDate(member.created_at)}
              </td>

              <td className={TD}>
                {canManage ? (
                  <TeamMemberActions
                    member={member}
                    currentUserId={currentUserId}
                    busy={pendingId === member.user_id}
                    onRoleChange={(role) => onRoleChange(member, role)}
                    onSetActive={(active) => onSetActive(member, active)}
                    onResend={() => onResend(member)}
                  />
                ) : (
                  <p className="text-right text-body-sm text-text-secondary">
                    {roleLabel(member.role)}
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
