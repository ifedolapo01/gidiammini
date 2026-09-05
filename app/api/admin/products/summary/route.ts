// app/api/admin/products/summary/route.ts - the counts above the products and
// stock tables, plus the change token both pages poll on.
//
// Split from the list routes for the same reason the orders summary is: a
// paged list cannot answer "how many products are there", and the poll that
// keeps the page live must not download a page of products every minute just
// to discover nothing moved. `?cursor=1` answers only that, in head-only
// queries that transfer no rows.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import {
  fetchAdminProductsSummary,
  fetchProductsChangeCursor,
} from '@/lib/commerce/admin-products-summary';

export const dynamic = 'force-dynamic';

function readThreshold(url: URL): number {
  const parsed = Number.parseInt(url.searchParams.get('lowStockThreshold') ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 1000) : 5;
}

export const GET = withAdminAuth(async (request, { supabase }) => {
  const url = new URL(request.url);

  try {
    if (url.searchParams.get('cursor') === '1') {
      return NextResponse.json({ success: true, cursor: await fetchProductsChangeCursor(supabase) });
    }

    const [summary, cursor] = await Promise.all([
      fetchAdminProductsSummary(supabase, readThreshold(url)),
      fetchProductsChangeCursor(supabase),
    ]);

    return NextResponse.json({ success: true, summary, cursor });
  } catch (error: any) {
    console.error('Error building products summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load product summary' },
      { status: 500 }
    );
  }
});
