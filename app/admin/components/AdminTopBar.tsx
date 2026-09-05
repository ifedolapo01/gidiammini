/** ADMIN layer — the slim bar above the page content.
 *
 * Everything that used to compete with ten nav links for one horizontal line
 * lives here instead, and there is now room for it: the menu button on small
 * screens, who is signed in, the theme toggle, and sign out.
 */
'use client';

import { Menu, LogOut, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Spinner, ThemeToggle } from '@/components/ui';

/** Mac shows ⌘, everything else shows Ctrl. Resolved on the client only, so
 * the server-rendered markup does not disagree with the first client render. */
function useShortcutHint(): string {
  const [hint, setHint] = useState('Ctrl K');

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setHint('⌘ K');
  }, []);

  return hint;
}

interface AdminTopBarProps {
  /** Display name of the signed-in admin, or null while it loads. */
  adminLabel: string | null;
  onOpenNav: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}

export default function AdminTopBar({
  adminLabel,
  onOpenNav,
  onLogout,
  loggingOut,
}: AdminTopBarProps) {
  const shortcut = useShortcutHint();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface px-4 shadow-elevation-1 sm:px-6">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="grid size-11 shrink-0 place-items-center rounded-control text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus lg:hidden"
      >
        <Menu className="size-6" aria-hidden="true" />
      </button>

      {/* Opens the same palette Ctrl/Cmd+K does. A shortcut nobody is told
          about is not a feature. */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
        className="hidden min-h-11 flex-1 items-center gap-2 rounded-control border border-border px-3 text-left text-body-sm text-text-muted transition-colors hover:bg-surface-hover sm:flex sm:max-w-xs"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate">Search…</span>
        <kbd className="rounded border border-border bg-background-secondary px-1.5 py-0.5 text-caption-md">
          {shortcut}
        </kbd>
      </button>

      <div className="flex-1" />

      {/* Which account is acting. Worth the space now that admins are named:
          this is the identity every audit entry is recorded against, and on a
          shared machine it is the only way to tell whose it is. */}
      {adminLabel && (
        <span
          className="hidden max-w-[14rem] truncate text-body-sm text-text-secondary sm:inline"
          title={adminLabel}
        >
          {adminLabel}
        </span>
      )}

      <ThemeToggle />

      <button
        type="button"
        onClick={onLogout}
        disabled={loggingOut}
        className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-control border border-destructive-border bg-destructive-background px-3 text-body-sm text-destructive transition-colors hover:bg-destructive-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-60 sm:px-4"
      >
        {loggingOut ? <Spinner size="xs" /> : <LogOut className="size-4" aria-hidden="true" />}
        <span className="hidden sm:inline">{loggingOut ? 'Logging out…' : 'Logout'}</span>
        <span className="sr-only sm:hidden">{loggingOut ? 'Logging out' : 'Log out'}</span>
      </button>
    </header>
  );
}
