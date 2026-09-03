/**
 * STOREFRONT layer — the last resort.
 *
 * app/error.tsx renders *inside* the root layout, so it cannot catch an error
 * thrown by the root layout itself. This can: it replaces the entire document,
 * which is why it has to supply its own <html> and <body> and import the
 * stylesheet — none of the layout's work has happened, so there is no font, no
 * theme script, no providers, no header.
 *
 * It follows that this file must depend on as little as possible. Everything it
 * touches is a thing that could have been what failed. So: no providers, no
 * Core primitives, no cart context, no next/link — a plain anchor, because a
 * client-side transition needs a router that may not have mounted. The tokens
 * come from globals.css, and the light palette on :root applies with no theme
 * script needed, so it renders correctly even though the pre-paint theme script
 * never ran.
 *
 * In development you will see Next's error overlay instead; this is a
 * production-only screen.
 */
'use client';

import { useEffect } from 'react';
import './globals.css';
import { reportError } from '@/lib/report-error';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: 'app/global-error.tsx' });
  }, [error]);

  return (
    <html lang="en">
      <body className="theme-storefront">
        <main
          role="alert"
          className="flex min-h-screen items-center justify-center bg-background px-4 py-16"
        >
          <div className="w-full max-w-md text-center">
            <h1 className="mb-3 text-h5 font-bold text-text-primary sm:text-h4">
              GidiamMini is temporarily unavailable
            </h1>
            <p className="mb-8 text-body-sm text-text-secondary sm:text-body-md">
              Something failed while loading the site itself. Please try again in
              a moment — no order or payment is affected by this.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-11 items-center justify-center rounded-control bg-primary px-4 text-body-md font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                Try again
              </button>
              {/* A full document load, deliberately. Whatever broke the root
                  layout is still broken in this runtime; starting the app over
                  from the server is more likely to work than routing within it. */}
              <a
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-control border border-border-strong px-4 text-body-md font-semibold text-text-primary transition-colors hover:bg-surface-hover"
              >
                Reload the site
              </a>
            </div>

            {error.digest && (
              <p className="mt-8 text-caption-md text-text-muted">
                Reference: <code className="font-mono">{error.digest}</code>
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
