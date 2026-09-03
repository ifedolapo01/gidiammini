/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// The storefront's error boundary.
//
// Before this existed, any error thrown while rendering a storefront route gave
// a production visitor a blank white page: no message, no retry, no way back to
// the shop. React unmounts the whole tree on an uncaught render error, and with
// no boundary to catch it there is nothing left to draw.
//
// This sits inside the root layout, so the header, the footer and the cart
// badge all survive — the visitor keeps their navigation and can carry on
// somewhere else even if this one route stays broken.
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button, ErrorState } from '@/components/ui';
import { reportError } from '@/lib/report-error';

export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    reportError(error, { boundary: 'app/error.tsx', path: pathname });
  }, [error, pathname]);

  return (
    <ErrorState
      title="Something went wrong"
      description={
        <>
          We could not load this page. This is our fault, not yours — trying
          again often works, and your cart has not been touched.
        </>
      }
      digest={error.digest}
      actions={
        <>
          {/* reset() re-renders the segment that threw. For anything
              intermittent — a dropped database connection, a slow query that
              timed out — that is genuinely all it takes. */}
          <Button variant="primary" size="md" onClick={reset}>
            Try again
          </Button>
          <Link
            href="/products"
            className="inline-flex h-11 items-center justify-center rounded-control border border-border-strong px-4 text-body-md font-semibold text-text-primary transition-colors hover:bg-surface-hover"
          >
            Continue shopping
          </Link>
        </>
      }
    />
  );
}
