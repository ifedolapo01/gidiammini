/** ADMIN layer — keeps a cashier on the one screen their role can use.
 *
 * Defence in depth only. The real boundary is the permission table
 * (lib/api/admin-route-permissions.ts) that every API request is checked
 * against — a cashier's underlying data calls fail regardless of what's on
 * screen. This just stops them from sitting on a stale bookmark to
 * /admin/dashboard (or anywhere else) looking at a page whose every request
 * comes back 403.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminRole } from '@/lib/api/admin-roles';

const COUNTER_SALE_PATH = '/admin/counter-sale';

export function useCashierRedirect(role: AdminRole | null | undefined, pathname: string): void {
  const router = useRouter();

  useEffect(() => {
    if (role === 'cashier' && pathname !== COUNTER_SALE_PATH && !pathname.startsWith(`${COUNTER_SALE_PATH}/`)) {
      router.replace(COUNTER_SALE_PATH);
    }
  }, [role, pathname, router]);
}
