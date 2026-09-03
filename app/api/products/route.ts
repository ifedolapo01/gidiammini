// app/api/products/route.ts - pages after the first.
//
// The first page is rendered by the server component at /products, which calls
// the same loader this does. That is the point of the split: one definition of
// what a page is, so "Load more" cannot return rows shaped differently from the
// ones already on screen, or ordered inconsistently with them.
//
// GET, because a page of a listing is a read.
import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import { parseProductFilters } from '@/lib/commerce/product-filters';
import { loadListingPage, withoutCursorKey } from '@/lib/commerce/product-listing';

async function browse(request: NextRequest) {
  const url = new URL(request.url);
  const filters = parseProductFilters(url.searchParams);

  // An unreadable or stale cursor is not an error — it is a pasted link or a
  // sort the shopper changed underneath it. decodeCursor() inside the loader
  // discards it and the response starts from the top.
  const cursor = url.searchParams.get('cursor');

  try {
    const page = await loadListingPage(filters, cursor);

    return NextResponse.json({
      success: true,
      // sort_value is the keyset key. The browser passes cursors back verbatim
      // and never builds one, so it has no business seeing the raw sort key —
      // which for a best-selling sort is the store's unit sales.
      products: withoutCursorKey(page.products),
      nextCursor: page.nextCursor,
      total: page.total,
    });
  } catch (error) {
    console.error('Product listing failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'We could not load more products just now. Please try again.',
        products: [],
        nextCursor: null,
        total: null,
      },
      { status: 503 }
    );
  }
}

export const GET = withRateLimit(
  RATE_LIMITS.browse,
  browse,
  'Too many requests. Please wait a moment and try again.'
);
