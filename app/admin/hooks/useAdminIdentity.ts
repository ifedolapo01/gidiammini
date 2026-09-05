/** ADMIN layer — the account this browser is signed in as.
 *
 * Fetched once. It only changes by signing out, which reloads the section
 * anyway, so there is nothing here to keep fresh.
 */
'use client';

import { useEffect, useState } from 'react';

export interface AdminIdentity {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
}

export function useAdminIdentity(enabled: boolean = true) {
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    fetch('/api/admin/session')
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (!cancelled && result?.success) setAdmin(result.admin ?? null);
      })
      .catch((error) => console.error('Could not read the admin session:', error));

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  /** What to call this admin on screen. */
  const label = admin ? admin.name || admin.email || 'Signed in' : null;

  return { admin, label };
}
