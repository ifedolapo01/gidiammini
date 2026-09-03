// app/api/account/reorder/route.ts - one tap to buy it again.
//
// Returns cart lines rather than mutating a cart: the cart lives in the
// browser (localStorage, CartProvider), so the server's job is to say what the
// lines *are* today — which product, which variant, what it costs now, and how
// many are actually in stock.
//
// Re-priced against the current catalogue on purpose. Adding lines at the
// price that was paid would put a cart on screen that disagrees with the
// checkout quote, and the customer would find out at the total.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import { parseJsonBody } from '@/lib/api/parse-body';
import { requireCustomer } from '@/lib/api/customer-session';
import { reorderSchema } from '@/lib/api/schemas/account';
import { buildReorder } from '@/lib/commerce/account-query';
import { reorderSummary } from '@/lib/commerce/customer-account';

async function reorder(request: NextRequest) {
  const guard = await requireCustomer(request);
  if (!guard.ok) return guard.response;

  const parsed = await parseJsonBody(request, reorderSchema);
  if (!parsed.ok) return parsed.response;

  const outcome = await buildReorder(createAdminClient(), guard.customer, parsed.data.orderId);

  // The ownership filter is part of the lookup, so somebody else's id reads as
  // "no such order" — the truth from this session's point of view.
  if (!outcome.ok) {
    return NextResponse.json(
      { success: false, error: 'We could not find that order on your account.' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    ...outcome.result,
    message: reorderSummary(outcome.result),
  });
}

export const POST = withRateLimit(
  RATE_LIMITS.reorder,
  reorder,
  'Too many reorders at once. Please wait a moment and try again.'
);
