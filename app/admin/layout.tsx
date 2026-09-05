/**
 * ADMIN layer — layout shell for the white-label Commerce Admin.
 * Depends only on Core (tokens, primitives) and admin config; brand
 * appearance comes from the .theme-admin token scope.
 *
 * A sidebar shell, not a top bar. Ten sections plus the brand, the account
 * name, a theme toggle and a sign-out button never fitted on one line — the
 * previous header wrapped its own nav on a 1920px display. Navigation is
 * vertical now, and everything else moved to a slim bar with room for it.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { MarqueeAlertBar } from './components/marquee-alert-bar';
import AdminSidebar from './components/AdminSidebar';
import AdminTopBar from './components/AdminTopBar';
import { MobileViewNotice } from './components/MobileViewNotice';
import CommandPalette from './components/CommandPalette';
import { useAdminSessionGuard } from './hooks/useAdminSessionGuard';
import { useAdminIdentity } from './hooks/useAdminIdentity';
import { useSidebarCollapsed } from './hooks/useSidebarCollapsed';
import { clearAdminRealtimeToken } from '@/lib/supabase/realtime-client';
import { cn } from '@/lib/utils';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // There is deliberately no `loading` gate here. Auth is middleware's job —
  // an unauthenticated request never reaches this component — so a gate would
  // guard nothing and cost a flash on every navigation.
  const pathname = usePathname();
  // Pages that stand on their own: no session yet, so no nav, no alert bar and
  // no polling that would only 401.
  const isLoginPage = pathname === '/admin/login';
  const isStandalone = isLoginPage || pathname === '/admin/accept-invite';

  const [navOpen, setNavOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  useAdminSessionGuard();
  const { admin, label: adminLabel } = useAdminIdentity(!isStandalone);
  const { collapsed, toggle: toggleCollapsed } = useSidebarCollapsed();

  // Close the drawer on navigation, or it stays open over the page just
  // requested.
  useEffect(() => setNavOpen(false), [pathname]);

  // Escape closes it, and the page behind it must not scroll while it is over
  // the top.
  useEffect(() => {
    if (!navOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [navOpen]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      // The realtime client caches the access token in memory; without this,
      // the next admin to sign in on this tab would open a socket with the
      // previous one's credentials until it expired.
      clearAdminRealtimeToken();
      router.push('/admin/login');
    } finally {
      setLoggingOut(false);
    }
  };

  // A standalone page gets the theme scope and nothing else — no nav to a
  // place you cannot go yet.
  if (isStandalone) {
    return <div className="theme-admin min-h-screen bg-background-tertiary">{children}</div>;
  }

  return (
    <div className="theme-admin min-h-screen bg-background-tertiary">
      <MarqueeAlertBar />
      <CommandPalette />

      <div className="flex">
        {/* Desktop rail. Sticky rather than fixed so it cannot overlap the
            content on short viewports, and scrolls its own list when the
            window is shorter than the nav. */}
        <aside
          className={cn(
            'hidden lg:block sticky top-0 h-screen shrink-0 transition-[width] duration-200',
            collapsed ? 'w-[4.5rem]' : 'w-64',
          )}
        >
          <AdminSidebar
            pathname={pathname}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            role={admin?.role ?? null}
          />
        </aside>

        {/* Mobile drawer. Rendered only while open, so nothing offscreen is in
            the tab order. */}
        {navOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setNavOpen(false)}
              className="absolute inset-0 bg-black/50"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Admin sections"
              className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-elevation-3"
            >
              <AdminSidebar
                pathname={pathname}
                collapsed={false}
                onToggleCollapsed={toggleCollapsed}
                onClose={() => setNavOpen(false)}
                role={admin?.role ?? null}
              />
            </div>
          </div>
        )}

        {/* min-w-0 so a wide table scrolls inside the main column instead of
            stretching the whole page and pushing the sidebar off screen. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopBar
            adminLabel={adminLabel}
            onOpenNav={() => setNavOpen(true)}
            onLogout={handleLogout}
            loggingOut={loggingOut}
          />

          <main className="flex-1 px-4 py-6 sm:px-6 md:py-8">
            <MobileViewNotice />
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
