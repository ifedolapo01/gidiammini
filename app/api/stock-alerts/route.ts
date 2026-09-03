// app/api/stock-alerts/route.ts - "email me when it's back".
//
// The out-of-stock notice used to offer two dead ends: "browse other products"
// and the wishlist, which nothing ever reads. This turns the same moment into
// the only thing the shopper actually wanted — being told when they can buy it.
//
// A person who asks to hear about one specific product has already chosen it.
// That is a better list than any newsletter signup, and the restock flow in the
// admin stock page drains it automatically.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import { parseJsonBody } from '@/lib/api/parse-body';
import { stockAlertSchema } from '@/lib/api/schemas/public-forms';
import { isBotSubmission } from '@/lib/api/schemas/common';

/** A second request while one is already pending. Not an error. */
const UNIQUE_VIOLATION = '23505';

/**
 * The same answer whether the row was created, already existed, or the
 * honeypot caught it.
 *
 * Distinguishing them would turn this into an oracle: submit an address, read
 * the response, learn whether that person is waiting for that product. Nothing
 * here is worth that, and "we'll email you" is true in every one of those cases.
 */
const CONFIRMATION = {
  success: true,
  message: "You're on the list. We'll email you the moment it's back.",
};

async function requestStockAlert(request: NextRequest) {
  const parsed = await parseJsonBody(request, stockAlertSchema);
  if (!parsed.ok) return parsed.response;

  const { email, productId, variantKey } = parsed.data;

  // Answered with success rather than an error, so a scripted submitter gets
  // no signal that it was detected.
  if (isBotSubmission(parsed.data)) {
    console.warn('Stock alert honeypot triggered — discarding silently.');
    return NextResponse.json(CONFIRMATION);
  }

  const supabase = createAdminClient();

  // The product has to exist and be listed. Without this the table becomes a
  // place to write arbitrary email addresses against arbitrary uuids.
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('is_active', true)
    .maybeSingle();

  if (!product) {
    return NextResponse.json(
      { success: false, error: 'That product is no longer available.' },
      { status: 404 }
    );
  }

  const { error } = await supabase.from('stock_alerts').insert({
    product_id: productId,
    variant_key: variantKey ?? null,
    // Stored as typed; the partial unique index is on lower(email), so
    // "Ada@example.com" cannot queue a second copy of "ada@example.com".
    email,
  });

  // The partial unique index rejects a second pending request for the same
  // person and product. They are already on the list, which is what they asked
  // for, so this is the success path.
  if (error && error.code !== UNIQUE_VIOLATION) {
    console.error('Stock alert insert failed:', error.message);
    return NextResponse.json(
      { success: false, error: 'We could not save that just now. Please try again.' },
      { status: 503 }
    );
  }

  return NextResponse.json(CONFIRMATION);
}

export const POST = withRateLimit(
  RATE_LIMITS.stockAlert,
  requestStockAlert,
  'Too many requests. Please wait a moment and try again.'
);
