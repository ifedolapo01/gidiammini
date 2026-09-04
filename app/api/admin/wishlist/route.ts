// app/api/admin/wishlist/route.ts - what people want but have not bought.
//
// The most valuable demand signal a small store has, and the one it was
// throwing away: a saved product is somebody saying "I want this" without
// spending anything, which is exactly the information that should decide what
// gets restocked next.
//
// Read from the most_wishlisted view (migration 20260904130000), so the
// definition of "most wishlisted" lives with the data rather than in a query
// typed into a route.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { rankWishlistDemand } from '@/lib/commerce/wishlist-demand';

/** Enough to act on. A longer list is a report, not a dashboard panel. */
const LIMIT = 8;

export const GET = withAdminAuth(async (_request, { supabase }) => {
  const { data, error } = await supabase
    .from('most_wishlisted')
    .select('product_id, product_name, main_image, stock, price, saved_by, last_saved_at')
    .order('saved_by', { ascending: false })
    .limit(LIMIT * 2);

  if (error) {
    console.error('Most-wishlisted lookup failed:', error.message);
    return NextResponse.json(
      { success: false, error: 'Could not load wishlist demand' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    products: rankWishlistDemand(data ?? [], LIMIT),
  });
});
