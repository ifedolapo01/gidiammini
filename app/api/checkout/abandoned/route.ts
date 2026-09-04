// app/api/checkout/abandoned/route.ts - remembering a cart that was not bought.
//
// Called from step one of checkout as soon as there is a valid email and
// something in the basket. That is the earliest honest moment: before the
// address there is nobody to remind, and after the order there is nothing to
// remind them about.
//
// Deliberately answers nothing useful. It returns the same body whether a row
// was written, refreshed or refused — a public endpoint keyed on an email
// address must not become a way to ask whether that address has shopped here,
// and it hands back no token, so it cannot be used to fish for somebody's
// basket either.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import { isValidEmail } from '@/lib/validation';
import { captureCart } from '@/lib/commerce/abandoned-cart-capture';

/** Said whatever happened. A function, not a shared response: a Response body
 *  can only be read once. See the header for why it never says more. */
const ok = () => NextResponse.json({ success: true });

async function recordCart(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';

  // Not an error worth reporting: this fires while somebody is still typing
  // their address, so a half-finished one is the normal case.
  if (!isValidEmail(email)) return ok();

  // Typed loosely until `npm run db:types` reruns against a database that has
  // migration 004000 — abandoned_carts is not in the generated types yet.
  const supabase: SupabaseClient = createAdminClient();

  await captureCart(supabase, {
    email,
    name: typeof body?.name === 'string' ? body.name : null,
    phone: typeof body?.phone === 'string' ? body.phone : null,
    items: body?.items,
  });

  return ok();
}

export const POST = withRateLimit(
  RATE_LIMITS.cartCapture,
  recordCart,
  // Never shown: the caller ignores the response entirely.
  'Too many requests.'
);
