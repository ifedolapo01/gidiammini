/** ADMIN layer — what state an admin account is in, as one badge.
 *
 * Three states worth distinguishing, because they need different actions:
 * revoked (restore them), invited but never signed in (resend it), and
 * working (nothing to do).
 */
'use client';

import { Badge } from '@/components/ui';
import { formatDate } from '@/lib/commerce/format-date';
import type { TeamMember } from '../hooks/useTeam';

export default function TeamMemberStatus({ member }: { member: TeamMember }) {
  if (!member.is_active) {
    return <Badge tone="destructive" variant="subtle">Access revoked</Badge>;
  }

  if (member.pending) {
    return <Badge tone="warning" variant="subtle">Invitation pending</Badge>;
  }

  return (
    <span className="text-caption-md text-text-secondary">
      {member.last_seen_at ? `Last seen ${formatDate(member.last_seen_at)}` : 'Active'}
    </span>
  );
}
