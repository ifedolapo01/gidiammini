/**
 * Rate limiting for the public API surface.
 *
 * State lives in Postgres (see supabase/migrations/20251101002200_rate_limits.sql)
 * rather than in memory, because the app runs on serverless functions: a
 * per-process counter resets on every cold start and is per-instance, so an
 * attacker simply gets the full allowance from each one.
 *
 * Composes with withAdminAuth — the limit runs first, so an unauthenticated
 * flood is rejected before it costs a JWT verification or a database read.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';

/** Postgres/PostgREST codes for "that function isn't there" — the signature of
 * code deployed ahead of its migration, not of an attack. */
const MISSING_FUNCTION_CODES = ['42883', 'PGRST202'];

export interface RateLimitRule {
  /** Namespace, so two endpoints never share a customer's budget. */
  bucket: string;
  /** Requests permitted per window. */
  limit: number;
  windowSeconds: number;
  /**
   * When the limiter itself cannot run (database unreachable), should the
   * request be refused?
   *
   * Default false — the endpoints being limited all need the database anyway,
   * so failing closed would only turn an outage into a worse outage. Set true
   * where letting requests through unmetered is the bigger risk: an
   * unthrottled password guesser does real damage during an outage, and the
   * admin cannot do anything useful while the database is down regardless.
   *
   * One case overrides this even when true: a MISSING check_rate_limit function
   * means the code was deployed ahead of its migration. That fails open, because
   * locking the only admin out of their own store over a forgotten `db push` is
   * a self-inflicted outage, not a defence.
   */
  failClosed?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
}

/**
 * Best-effort client IP.
 *
 * On Vercel the platform sets these headers, so the leftmost x-forwarded-for
 * entry is the real client. Hitting the app directly (no proxy in front) means
 * a caller can forge them — which is why anything genuinely security-critical
 * uses a second, non-spoofable key as well (the login route also limits per
 * account, not just per IP).
 */
export function clientIdentifier(request: NextRequest): string {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  if (first) return first;

  // No usable header: bucket these together rather than skipping the limit
  // entirely, so a proxy misconfiguration fails safe instead of open.
  return 'unknown';
}

/** Namespaced key. Keep it short — it is the table's primary key. */
export function rateLimitKey(bucket: string, identifier: string): string {
  return `${bucket}:${identifier}`.slice(0, 200);
}

/**
 * Records one request against `key` and reports whether it is allowed.
 * `count: false` reads the current state without consuming the allowance.
 */
export async function checkRateLimit(
  key: string,
  rule: Pick<RateLimitRule, 'limit' | 'windowSeconds' | 'failClosed'>,
  options: { count?: boolean } = {}
): Promise<RateLimitResult> {
  const fallback = (allowed: boolean): RateLimitResult => ({
    allowed,
    limit: rule.limit,
    remaining: rule.limit,
    retryAfter: rule.windowSeconds,
  });

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
      p_count: options.count !== false,
    });

    if (error || !data) {
      // A MISSING function is a deployment mistake, not an attack: the code
      // shipped before its migration did. Fail open even for failClosed rules —
      // otherwise forgetting `db push` locks the admin out of their own store,
      // which is a self-inflicted outage rather than a defence.
      if (error && MISSING_FUNCTION_CODES.includes(error.code ?? '')) {
        console.error(
          'check_rate_limit() is missing — run supabase/migrations/20251101002200_rate_limits.sql. ' +
          'Rate limiting is DISABLED until then.'
        );
        return fallback(true);
      }

      console.error('Rate limit check failed:', error?.message ?? 'no data returned');
      return fallback(!rule.failClosed);
    }

    const result = data as Record<string, unknown>;
    return {
      allowed: result.allowed === true,
      limit: Number(result.limit) || rule.limit,
      remaining: Number(result.remaining) || 0,
      retryAfter: Number(result.retry_after) || rule.windowSeconds,
    };
  } catch (caught: any) {
    console.error('Rate limit check threw:', caught?.message ?? caught);
    return fallback(!rule.failClosed);
  }
}

/** Clears a key — used after a successful login so earlier typos don't linger. */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await createAdminClient().rpc('reset_rate_limit', { p_key: key });
  } catch (caught: any) {
    console.error('Rate limit reset failed:', caught?.message ?? caught);
  }
}

/** 429 with the headers a well-behaved client (and Googlebot) expects. */
export function tooManyRequests(result: RateLimitResult, message: string): NextResponse {
  return NextResponse.json(
    { success: false, error: message, retryAfter: result.retryAfter },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfter),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
      },
    }
  );
}

type RouteHandler<Ctx> = (request: NextRequest, ctx: Ctx) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a route handler in a per-IP limit.
 *
 * Applied outside withAdminAuth so the cheap check runs first:
 *   export const POST = withRateLimit(RULE, withAdminAuth(handler));
 */
export function withRateLimit<Ctx>(
  rule: RateLimitRule,
  handler: RouteHandler<Ctx>,
  message = 'Too many requests. Please wait a moment and try again.'
) {
  return async (request: NextRequest, ctx: Ctx): Promise<NextResponse> => {
    const result = await checkRateLimit(rateLimitKey(rule.bucket, clientIdentifier(request)), rule);

    if (!result.allowed) {
      console.warn(`Rate limit hit: ${rule.bucket} from ${clientIdentifier(request)}`);
      return tooManyRequests(result, message);
    }

    return handler(request, ctx);
  };
}
