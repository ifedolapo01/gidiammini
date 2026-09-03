/**
 * ADMIN layer — error boundary for the white-label Commerce Admin.
 * Depends only on Core (tokens + primitives). Imports no Storefront code and
 * names no shop: the copy is deliberately generic so the same panel ships with
 * whatever this admin is branded as.
 *
 * Separate from app/error.tsx because the audiences are not the same. A shopper
 * wants to be pointed back at the products; an operator wants to know which
 * screen failed, to get back to the dashboard, and to have a reference they can
 * quote when they report it.
 *
 * Rendered inside app/admin/layout.tsx, so the sidebar and the session guard
 * survive — one broken screen does not log anybody out.
 */
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button, ErrorState } from '@/components/ui';
import { reportError } from '@/lib/report-error';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    reportError(error, { boundary: 'app/admin/error.tsx', path: pathname });
  }, [error, pathname]);

  return (
    <ErrorState
      className="min-h-[50vh]"
      title="This screen failed to load"
      description={
        <>
          Something went wrong while rendering{' '}
          <code className="font-mono text-text-primary">{pathname}</code>. No
          changes were saved. Retrying reloads just this screen.
        </>
      }
      digest={error.digest}
      actions={
        <>
          <Button variant="primary" size="md" onClick={reset}>
            Retry
          </Button>
          <Link
            href="/admin/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-control border border-border-strong px-4 text-body-md font-semibold text-text-primary transition-colors hover:bg-surface-hover"
          >
            Back to dashboard
          </Link>
        </>
      }
    />
  );
}
