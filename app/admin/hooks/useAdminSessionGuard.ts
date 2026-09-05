/** ADMIN layer — detects an expired/invalid admin session from any admin API
 * call and recovers gracefully, instead of leaving whichever hook made the
 * call to show a bare "failed to fetch" error with a Retry button that would
 * just fail again against the same stale cookie.
 *
 * Every admin data hook (orders, products, dashboard, discounts, ...) makes
 * its own plain fetch() call — there are ~15 of them. Rather than duplicate
 * "if 401, log out and redirect" in each one (and risk missing it in future
 * hooks), this patches window.fetch once for the lifetime of the admin
 * section: any 401 response means the session itself is invalid (see
 * lib/api/admin-session.ts — no non-admin route in this app ever returns 401),
 * so it's always safe to treat one as "please log in again." The one exception
 * is the login endpoint itself, whose 401 means "wrong password," not "session
 * expired." */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { clearAdminRealtimeToken } from '@/lib/supabase/realtime-client';

export function useAdminSessionGuard() {
  const router = useRouter();

  useEffect(() => {
    const originalFetch = window.fetch;
    let expired = false;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      const [input] = args;
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);

      if (response.status === 401 && !expired && !url.includes('/api/admin/login')) {
        expired = true;
        toast.error('Your session has expired. Please log in again.');
        clearAdminRealtimeToken();
        originalFetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
        router.replace('/admin/login');
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [router]);
}
