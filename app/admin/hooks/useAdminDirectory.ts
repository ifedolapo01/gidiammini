/** ADMIN layer — the list of admins, for anywhere that needs to name one.
 *
 * Exists for the activity feed's "who" filter. Filtering by person is the
 * point of a per-person audit trail, and a free-text box that only works if
 * you spell a colleague's address correctly is not a filter anybody uses.
 *
 * Degrades quietly: a role that may read the trail but not the team list gets
 * an empty directory and a filter that simply offers no names, rather than an
 * error on a screen that is otherwise working.
 */
'use client';

import { useEffect, useState } from 'react';

export interface AdminDirectoryEntry {
  email: string;
  /** Their name where one is recorded, otherwise the address. */
  label: string;
  is_active: boolean;
}

export function useAdminDirectory(enabled: boolean = true) {
  const [admins, setAdmins] = useState<AdminDirectoryEntry[]>([]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    fetch('/api/admin/team')
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (cancelled || !result?.success) return;

        setAdmins(
          (result.members ?? []).map((member: any) => ({
            email: member.email,
            // Revoked colleagues stay listed: most of what anyone wants to
            // look up about somebody is what they did before they left.
            label: member.name ? `${member.name} (${member.email})` : member.email,
            is_active: member.is_active,
          }))
        );
      })
      .catch(() => {
        // See the header — an unavailable directory is not an error state.
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { admins };
}
