// app/api/events/route.ts - the storefront's behavioural funnel.
//
// Fires on view_item, add_to_cart, begin_checkout and purchase (see
// lib/commerce/storefront-events.ts for the client that batches and sends
// these). Every admin analytics panel before this was computed from orders,
// which can say what sold but not what nearly sold — this is the denominator
// those numbers were missing.
//
// Public and unauthenticated by design, like stock-alerts and abandoned-cart
// capture: it runs before withAdminAuth would ever apply. The service-role
// client is used for the same reason those routes use it — the table has no
// anon grant at all, so nothing else could write to it.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import { parseJsonBody } from '@/lib/api/parse-body';
import { trackEventsSchema } from '@/lib/api/schemas/events';
import { hashSessionId } from '@/lib/api/session-hash';

async function trackEvents(request: NextRequest) {
  const parsed = await parseJsonBody(request, trackEventsSchema);
  if (!parsed.ok) return parsed.response;

  const rows = parsed.data.events.map((entry) => ({
    event: entry.event,
    session_id: hashSessionId(entry.sessionId),
    product_id: entry.productId ?? null,
    variant_key: entry.variantKey ?? null,
    value: entry.value ?? null,
  }));

  const supabase = createAdminClient();
  const { error } = await supabase.from('storefront_events').insert(rows);

  if (error) {
    // Analytics losing a batch is not worth surfacing to the shopper — the
    // page they are on does not depend on it, and a toast here would be noise
    // for a failure they can do nothing about.
    console.error('Storefront event insert failed:', error.message);
  }

  // Same response whether the insert succeeded or not: the tracker fires and
  // forgets (sendBeacon on unload cannot read a response at all), so there is
  // no caller to report a failure to.
  return NextResponse.json({ success: true });
}

export const POST = withRateLimit(RATE_LIMITS.storefrontEvents, trackEvents);
