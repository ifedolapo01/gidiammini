/** ADMIN layer — recovers gracefully when an admin session turns out to be
 * expired or invalid, instead of leaving whichever hook made the call to show a
 * bare "failed to fetch" error with a Retry button that would just fail again
 * against the same stale cookie.
 *
 * Every admin data call goes through adminFetch (app/admin/lib/admin-fetch.ts),
 * which reports a 401 here. This hook owns what happens next, because that part
 * needs the router and the toast: say so once, drop the realtime token, tell
 * the server to clear the cookie, and send the person to the login form.
 *
 * It used to do the detecting as well, by replacing window.fetch for the
 * lifetime of the admin section — see admin-fetch.ts for why that reach was
 * worth giving up. */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { clearAdminRealtimeToken } from '@/lib/supabase/realtime-client';
import { setAdminSessionExpiredHandler } from '@/app/admin/lib/admin-fetch';

export function useAdminSessionGuard() {
  const router = useRouter();

  useEffect(() => {
    // Latched: several hooks poll in parallel, so one expired session produces
    // a burst of 401s. Without this the person gets a stack of identical
    // toasts and a redirect for each one.
    let expired = false;

    setAdminSessionExpiredHandler(() => {
      if (expired) return;
      expired = true;

      toast.error('Your session has expired. Please log in again.');
      clearAdminRealtimeToken();
      // Plain fetch, not adminFetch: logout answering 401 would re-enter the
      // handler it was called from.
      fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
      router.replace('/admin/login');
    });

    return () => setAdminSessionExpiredHandler(null);
  }, [router]);
}
