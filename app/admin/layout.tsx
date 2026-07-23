/**
 * ADMIN layer — layout shell for the white-label Commerce Admin.
 * Depends only on Core (tokens, primitives) and admin config; brand
 * appearance comes from the .theme-admin token scope.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner, ThemeToggle } from '@/components/ui';
import { MarqueeAlertBar } from './components/marquee-alert-bar';
import { adminConfig } from './config';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  useEffect(() => {
    // Just check auth, don't redirect
    const checkAuth = async () => {
      setLoading(false); // Let middleware handle redirects
    };

    checkAuth();
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.push('/admin/login');
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="theme-admin min-h-screen flex items-center justify-center">
        <Spinner size="xl" className="text-primary" />
      </div>
    );
  }

  return (
    <div className="theme-admin min-h-screen bg-background-tertiary">
      {pathname !== '/admin/login' && <MarqueeAlertBar />}

      {/* Admin Header - Only show if not on login page */}
      {pathname !== '/admin/login' && (
        <header className="bg-surface border-b border-border shadow-elevation-1">
          <div className="container mx-auto px-4 sm:px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center justify-between w-full md:w-auto">
                {/* Logo and mobile menu button */}
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="md:hidden text-text-secondary hover:text-text-primary"
                    aria-label="Toggle menu"
                    aria-expanded={mobileMenuOpen}
                  >
                    {mobileMenuOpen ? (
                      <X className="size-6" aria-hidden="true" />
                    ) : (
                      <Menu className="size-6" aria-hidden="true" />
                    )}
                  </button>

                  <Link href="/admin/dashboard" className="text-h5 font-bold text-text-primary">
                    {adminConfig.brandName}
                  </Link>
                </div>

                {/* Desktop Navigation - Hidden on mobile */}
                <nav className="hidden md:flex space-x-4 ml-6">
                  {adminConfig.navigation.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'px-3 py-2 transition-colors',
                        isActive(item.href)
                          ? 'text-primary font-bold border-b-2 border-primary'
                          : 'text-text-secondary hover:text-text-primary',
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <ThemeToggle />
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="px-4 py-2 flex items-center gap-2 bg-destructive-background text-destructive border border-destructive-border rounded-control hover:bg-destructive-border transition-colors text-body-sm whitespace-nowrap disabled:opacity-60 disabled:pointer-events-none"
                >
                  {loggingOut && <Spinner size="xs" />}
                  {loggingOut ? 'Logging out…' : 'Logout'}
                </button>
              </div>
            </div>

            {/* Mobile Navigation Menu */}
            {mobileMenuOpen && (
              <div className="md:hidden mt-4 pb-4 border-t border-divider pt-4">
                <nav className="flex flex-col space-y-2">
                  {adminConfig.navigation.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'px-4 py-3 rounded-control transition-colors',
                        isActive(item.href)
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            )}
          </div>
        </header>
      )}

      <main className="container mx-auto px-4 sm:px-6 py-6 md:py-8">
        {pathname !== '/admin/login' && (
          <div className="md:hidden mb-6 bg-warning-background border-l-4 border-warning p-4 rounded-surface shadow-elevation-1">
            <div className="flex items-start">
              <div className="shrink-0 pt-0.5">
                <svg className="size-5 text-warning" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-body-sm font-medium text-text-primary">Desktop View Recommended</h3>
                <div className="mt-1 text-body-sm text-text-secondary">
                  <p>
                    For the best experience using the admin portal, please enable <strong>"Desktop site"</strong> in your browser settings (usually found by tapping the three vertical dots <span className="font-bold text-body-lg leading-none align-middle">⋮</span>).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
