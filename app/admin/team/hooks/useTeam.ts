/** ADMIN layer — the admin list, and the three things that change it.
 *
 * All state for the Team screen lives here so the page and its components stay
 * presentational: they render what this returns and call what it exposes.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminRole } from '@/lib/api/admin-roles';

export interface TeamMember {
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  last_seen_at: string | null;
  invited_at: string | null;
  created_at: string;
  pending: boolean;
}

export interface InviteInput {
  email: string;
  name: string;
  role: AdminRole;
}

/** What a mutation reports back, so the caller can toast it and show a link
 * when the invitation email could not be delivered. */
export interface TeamActionResult {
  ok: boolean;
  message: string;
  /** Only present when the email failed and the owner must pass the link on. */
  inviteUrl?: string;
}

export function useTeam() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /** The row with a request in flight, so only its own controls show a spinner. */
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/team');
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        setError(result?.error || 'Could not load the team. Please try again.');
        setMembers([]);
        return;
      }

      setMembers(result.members ?? []);
    } catch {
      setError('Could not reach the server. Please check your connection.');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** One place for the fetch, the error shape and the reload, so invite,
   * re-role, revoke, restore and resend cannot drift apart. */
  const send = useCallback(
    async (url: string, method: 'POST' | 'PATCH', body: unknown): Promise<TeamActionResult> => {
      try {
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          return { ok: false, message: result?.error || 'That did not work. Please try again.' };
        }

        await load();
        return { ok: true, message: result.message || 'Saved.', inviteUrl: result.inviteUrl };
      } catch {
        return { ok: false, message: 'Could not reach the server. Please check your connection.' };
      }
    },
    [load]
  );

  const invite = useCallback(
    async (input: InviteInput) => {
      setInviting(true);
      try {
        return await send('/api/admin/team', 'POST', input);
      } finally {
        setInviting(false);
      }
    },
    [send]
  );

  const update = useCallback(
    async (userId: string, changes: { role?: AdminRole; is_active?: boolean; resendInvite?: true }) => {
      setPendingId(userId);
      try {
        return await send(`/api/admin/team/${userId}`, 'PATCH', changes);
      } finally {
        setPendingId(null);
      }
    },
    [send]
  );

  return { members, loading, error, pendingId, inviting, reload: load, invite, update };
}
