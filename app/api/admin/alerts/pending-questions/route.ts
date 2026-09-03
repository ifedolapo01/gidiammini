// app/api/admin/alerts/pending-questions/route.ts - how many questions are unanswered.
//
// A head-only count for the alert ticker, like its pending-reviews sibling.
// This one is the more urgent of the two: an unanswered question is a shopper
// waiting on a reply before they will buy, and every hour it sits there is an
// hour they are deciding without it.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';

export const GET = withAdminAuth(async (_request, { supabase }) => {
  const { count, error } = await supabase
    .from('product_questions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) {
    console.error('Error counting pending questions:', error);
    // 200 with a zero, like every other alert route: the ticker treats a
    // missing source as "nothing to say".
    return NextResponse.json({ success: false, pendingCount: 0 });
  }

  return NextResponse.json({ success: true, pendingCount: count ?? 0 });
});
