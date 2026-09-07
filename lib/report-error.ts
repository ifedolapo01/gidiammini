/**
 * CORE layer — the one place a caught render error is reported.
 *
 * There is no error tracker installed in this project today. That is a
 * deliberate gap rather than an oversight in this module: picking Sentry (or
 * anything else) is a dependency, an account and a cost, and none of those are
 * mine to choose. What this does give you is the seam — every error boundary in
 * the app funnels through `reportError`, so wiring a tracker is a change to one
 * function body and to nothing else.
 *
 * Everything it catches goes through lib/logger.ts, so a boundary hit is a
 * structured line with a level and a digest rather than a console string.
 *
 * To wire one up, install it and add the call under the marked line below. The
 * `digest` is the important field to forward: Next replaces a production error's
 * message with an opaque hash so the message cannot leak server internals to the
 * browser, and that hash is the only way to match what the visitor saw against
 * the real stack trace in your server logs.
 */

import { logger } from './logger';

export interface ErrorContext {
  /** Which boundary caught it — "app/error.tsx", "app/admin/error.tsx". */
  boundary: string;
  /** The route the visitor was on, when the boundary can name it. */
  path?: string;
}

/**
 * Reports an error caught by a boundary. Never throws: a failure to report
 * must not replace the error page with a second error page.
 */
export function reportError(error: Error & { digest?: string }, context: ErrorContext): void {
  try {
    // Through the structured logger, so a boundary hit is one queryable line
    // in the platform's collector rather than a string somebody has to find by
    // eye. The digest is what matches the opaque message the visitor saw to
    // the real stack — see lib/logger.ts#describeError, which always keeps it.
    logger.error('error boundary caught', error, {
      boundary: context.boundary,
      path: context.path,
    });

    // WIRE YOUR TRACKER HERE, e.g.:
    //   Sentry.captureException(error, {
    //     tags: { boundary: context.boundary, digest: error.digest },
    //     extra: { path: context.path },
    //   });
  } catch {
    // Reporting is best-effort by definition. If the tracker itself is broken,
    // the visitor still gets the error page and the retry button.
  }
}
