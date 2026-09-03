// app/api/recommendations/route.ts - the three rails.
//
// One route rather than three, because all three answer the same question with
// a different id source: given some context, which product cards should this
// rail draw. Splitting them would triplicate the validation and the response
// shape for no gain.
//
// GET, and the ids travel in the query string. That is a deliberate limit as
// well as a convention: it caps how much history a page can ask about in one
// request, and there is nothing here worth a body.
import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import {
  loadRelatedProducts,
  loadCartRecommendations,
  loadProductsByIds,
  loadActiveDiscounts,
} from '@/lib/commerce/recommendations';
import { MAX_RECENTLY_VIEWED } from '@/lib/commerce/recently-viewed';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A cart with more lines than this is not a cart; it is someone probing. */
const MAX_IDS = Math.max(MAX_RECENTLY_VIEWED, 20);

/**
 * Every id is checked against the uuid shape before it reaches Postgres.
 *
 * These arrive from localStorage and from a query string, so they are input
 * like any other — and a malformed uuid inside an array parameter is a type
 * error at the database, not a graceful empty result.
 */
function parseIds(raw: string | null): string[] {
  if (!raw) return [];

  const seen = new Set<string>();
  for (const candidate of raw.split(',')) {
    const id = candidate.trim();
    if (UUID_PATTERN.test(id)) seen.add(id);
    if (seen.size >= MAX_IDS) break;
  }
  return [...seen];
}

const EMPTY = { success: true, products: [], discounts: [] };

async function recommend(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const type = params.get('type');

  try {
    if (type === 'related') {
      const productId = params.get('productId') ?? '';
      if (!UUID_PATTERN.test(productId)) return NextResponse.json(EMPTY);

      const [products, discounts] = await Promise.all([
        loadRelatedProducts(productId),
        loadActiveDiscounts(),
      ]);
      return NextResponse.json({ success: true, products, discounts });
    }

    if (type === 'cart' || type === 'viewed') {
      const ids = parseIds(params.get('ids'));
      if (ids.length === 0) return NextResponse.json(EMPTY);

      const [products, discounts] = await Promise.all([
        type === 'cart' ? loadCartRecommendations(ids) : loadProductsByIds(ids),
        loadActiveDiscounts(),
      ]);
      return NextResponse.json({ success: true, products, discounts });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown recommendation type.', products: [], discounts: [] },
      { status: 400 }
    );
  } catch (error) {
    // A rail is decoration. It fails quietly and renders nothing rather than
    // showing an error where a suggestion would have been.
    console.error('Recommendations failed:', error);
    return NextResponse.json(EMPTY);
  }
}

export const GET = withRateLimit(
  RATE_LIMITS.browse,
  recommend,
  'Too many requests. Please wait a moment and try again.'
);
