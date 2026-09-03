// app/api/admin/alerts/pending-reviews/route.ts - how many reviews are waiting.
//
// One head-only count, for the alert ticker that polls every two minutes. The
// moderation queue at /api/admin/reviews already returns these counts, but it
// also returns a page of rows and their joined products — fine for a page
// somebody opened, wasteful for a number in a ticker.
//
// Pending is the only status worth alerting on: a review nobody has published
// is invisible to shoppers, so a customer's effort is sitting in a table doing
// nothing for the product page it was written about.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';

export const GET = withAdminAuth(async (_request, { supabase }) => {
  const { count, error } = await supabase
    .from('product_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) {
    console.error('Error counting pending reviews:', error);
    // 200 with a zero, like its sibling alert routes: the ticker treats a
    // missing source as "nothing to say", and a 500 here would put a scary
    // console error in front of an admin over a decoration.
    return NextResponse.json({ success: false, pendingCount: 0 });
  }

  return NextResponse.json({ success: true, pendingCount: count ?? 0 });
});
