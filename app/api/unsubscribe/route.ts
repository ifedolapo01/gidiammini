/**
 * Taking somebody off the list.
 *
 * Two methods, on purpose.
 *
 * POST is what the page calls and what RFC 8058 one-click unsubscribe posts.
 * It is the one that changes anything.
 *
 * GET exists because mail clients and corporate scanners follow links in
 * emails to check them, and a GET that unsubscribed on sight would opt people
 * out of a list they are still reading. So GET only reports whether the token
 * is good and who it belongs to; the page then shows a button. RFC 9057 and
 * every serious guide say the same thing.
 *
 * Public — no session. That is the point: an unsubscribe that requires signing
 * in is an unsubscribe most people give up on and report as spam instead,
 * which costs the shop its ability to reach everybody else. The token is the
 * authorisation, and the only thing it authorises is stopping mail to one
 * address.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifyUnsubscribeToken } from '@/lib/notifications/unsubscribe-token';
import { checkRateLimit, clientIdentifier, rateLimitKey } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Same wording whatever went wrong. A public endpoint that distinguishes "no
 *  such subscriber" from "wrong token" is an endpoint that answers questions
 *  about who is on the list. */
const BAD_LINK = 'That unsubscribe link is not valid. It may have been altered in transit.';

interface Resolved {
  id: string;
  email: string;
  alreadyOff: boolean;
}

async function resolve(request: NextRequest): Promise<Resolved | null> {
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') ?? '').trim();
  const token = (url.searchParams.get('t') ?? '').trim();

  // Shape-checked before any database work, so a crawler poking the endpoint
  // costs nothing.
  if (!UUID.test(id) || !verifyUnsubscribeToken(id, token)) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('subscribers')
    .select('id, email, is_active')
    .eq('id', id)
    .maybeSingle();

  if (!data) return null;
  return { id: data.id, email: data.email, alreadyOff: data.is_active === false };
}

/** Confirms the link without acting on it. */
export async function GET(request: NextRequest) {
  const subscriber = await resolve(request);
  if (!subscriber) {
    return NextResponse.json({ success: false, error: BAD_LINK }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    // Enough to show "we will stop emailing amaka@…" and no more. Never the
    // subscriber's name or anything else on the row.
    email: subscriber.email,
    alreadyUnsubscribed: subscriber.alreadyOff,
  });
}

export async function POST(request: NextRequest) {
  // Loose, but not absent. Nothing here is destructive beyond one row the
  // caller already proved they hold a token for, and the token check is the
  // real gate — this only stops somebody grinding the endpoint.
  const limit = await checkRateLimit(
    rateLimitKey(RATE_LIMITS.unsubscribe.bucket, clientIdentifier(request)),
    RATE_LIMITS.unsubscribe
  );

  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many attempts. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  const subscriber = await resolve(request);
  if (!subscriber) {
    return NextResponse.json({ success: false, error: BAD_LINK }, { status: 400 });
  }

  // Idempotent: a second click, or a scanner that follows the POST, must read
  // as success. Telling somebody their unsubscribe "failed" because it already
  // worked is how a complaint gets filed.
  if (subscriber.alreadyOff) {
    return NextResponse.json({ success: true, email: subscriber.email, alreadyUnsubscribed: true });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('subscribers')
    .update({
      is_active: false,
      unsubscribed_at: new Date().toISOString(),
      unsubscribe_source: 'link',
    })
    .eq('id', subscriber.id);

  if (error) {
    console.error('Unsubscribe failed:', error);
    return NextResponse.json(
      { success: false, error: 'We could not process that just now. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, email: subscriber.email, alreadyUnsubscribed: false });
}
