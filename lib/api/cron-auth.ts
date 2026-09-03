/**
 * API layer — the shared gate on every /api/cron route.
 *
 * Each cron route had its own copy of this check, and the copies had already
 * diverged into two different policies. That divergence is real and worth
 * keeping — it just needs to be a named choice rather than an accident of which
 * route was written first:
 *
 *   * `failClosed: false` — the promotional jobs. A missing CRON_SECRET means
 *     an unconfigured deployment (a preview, a local run), and the worst an
 *     unauthenticated call achieves is sending mail that was going out anyway.
 *   * `failClosed: true` — anything that destroys or rewrites state. Without a
 *     secret configured, the route refuses to run at all, so a public URL can
 *     never become a mass-cancel button or a free way to make the database
 *     recompute a table on demand.
 *
 * Returns a Response to send back, or null to carry on.
 */
import { NextRequest, NextResponse } from 'next/server';

export interface CronAuthOptions {
  /** Refuse to run when CRON_SECRET is unset. Default false. */
  failClosed?: boolean;
  /** Named in the log when a fail-closed route refuses. */
  jobName?: string;
}

export function authorizeCron(
  request: NextRequest,
  { failClosed = false, jobName = 'cron job' }: CronAuthOptions = {}
): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    if (!failClosed) return null;

    console.error(`CRON_SECRET is not set — refusing to run ${jobName}.`);
    return NextResponse.json(
      { success: false, error: 'Cron is not configured on this deployment.' },
      { status: 503 }
    );
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
