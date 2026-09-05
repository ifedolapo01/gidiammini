/** ADMIN layer — whether the sidebar is showing labels or just icons.
 *
 * Remembered per browser, because it is a working preference rather than a
 * setting: somebody on a laptop collapses it for screen width and expects it
 * to stay that way tomorrow.
 *
 * Reads from storage in an effect rather than in the initial state, so the
 * server-rendered markup and the first client render agree. Initialising from
 * localStorage directly is the classic hydration mismatch.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'admin:sidebar-collapsed';

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      // Private windows and blocked site data both throw. The default stands.
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Preference simply will not persist; the toggle still works.
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
