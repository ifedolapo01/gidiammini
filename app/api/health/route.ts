/**
 * BACKEND — is this deployment actually working?
 *
 * There was no health endpoint, so the only uptime signal was a customer
 * complaining. This is what an uptime monitor polls: it exercises the two
 * dependencies whose failure is invisible from the outside — the database,
 * and the mail transport that every order confirmation goes through.
 *
 * MAIL IS THE ONE THIS EXISTS FOR
 *
 * Notification failures are caught and swallowed on purpose, so that a bad
 * email never blocks an order. That is right, and it also means a mail
 * transport that has stopped working is completely silent until somebody
 * notices they never got a receipt. This check is what makes it loud.
 *
 * WHAT IT DELIBERATELY DOES NOT RETURN
 *
 * Error messages. This route is public — it has to be, for a monitor to reach
 * it — and a database error string names tables, columns and sometimes
 * credentials. The detail goes to the log under the request id; the response
 * says only which check failed.
 */
import { NextResponse } from 'next/server';
import { testAdminConnection } from '@/lib/supabase/admin-server';
import { testEmailConnection } from '@/lib/email';
import { requestContext, requestIdHeaders } from '@/lib/api/request-id';

// Never cached, never prerendered: a cached health check is a lie.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Long enough for a cold connection, short enough that a monitor's own
 *  timeout is not what fires first. */
const CHECK_TIMEOUT_MS = 5_000;

type CheckState = 'ok' | 'fail' | 'timeout';

/**
 * Runs one dependency check under a deadline. A hung TCP connect is the most
 * common way a dependency fails, and without this the health check hangs with
 * it — reporting nothing at exactly the moment it matters most.
 */
async function check(
  name: string,
  run: () => Promise<{ success: boolean; error?: string }>,
  log: ReturnType<typeof requestContext>['log'],
): Promise<CheckState> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      run(),
      new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), CHECK_TIMEOUT_MS);
      }),
    ]);

    if (result === 'timeout') {
      log.error(`health: ${name} timed out`, undefined, { check: name, timeoutMs: CHECK_TIMEOUT_MS });
      return 'timeout';
    }
    if (!result.success) {
      log.error(`health: ${name} failed`, result.error, { check: name });
      return 'fail';
    }
    return 'ok';
  } catch (error) {
    log.error(`health: ${name} threw`, error, { check: name });
    return 'fail';
  } finally {
    // Otherwise a fast check keeps the process awake for the full timeout.
    if (timer) clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  const { requestId, log } = requestContext(request);
  const startedAt = Date.now();

  const [database, mail] = await Promise.all([
    check('database', testAdminConnection, log),
    check('mail', testEmailConnection, log),
  ]);

  const healthy = database === 'ok' && mail === 'ok';
  const body = {
    status: healthy ? ('ok' as const) : ('degraded' as const),
    checks: { database, mail },
    durationMs: Date.now() - startedAt,
    requestId,
  };

  if (!healthy) log.warn('health: degraded', { checks: body.checks });

  // 503 rather than a 200 with a sad body: monitors alert on status codes.
  return NextResponse.json(body, {
    status: healthy ? 200 : 503,
    headers: { ...requestIdHeaders(requestId), 'cache-control': 'no-store' },
  });
}
