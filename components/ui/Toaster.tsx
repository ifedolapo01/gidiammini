/**
 * CORE layer — generic UI primitive. Token-based, no business branding.
 * Thin wrapper around sonner, styled entirely with semantic tokens (which are
 * business-independent :root values, see globals.css) so it renders correctly
 * whether mounted under .theme-storefront or .theme-admin, and in light/dark.
 */
'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex items-start gap-3 w-full rounded-overlay border border-border bg-surface p-4 shadow-elevation-3 text-body-sm text-text-primary',
          title: 'font-medium text-text-primary',
          description: 'text-text-secondary',
          success: 'border-l-4 border-l-success',
          error: 'border-l-4 border-l-destructive',
          warning: 'border-l-4 border-l-warning',
          info: 'border-l-4 border-l-info',
        },
      }}
    />
  );
}
