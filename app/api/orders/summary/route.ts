// app/api/orders/summary/route.ts - the figures above the admin orders list,
// plus the change token that page polls on.
//
// Split out from the list route on purpose. The list is now paged, so it can
// no longer answer "how many orders are there in total" — and the poll that
// keeps the page live must not pull a page of orders every minute just to find
// out whether anything moved. `?cursor=1` answers only that question, in two
// head-only queries that transfer no rows.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { fetchAdminOrdersSummary, fetchOrdersChangeCursor } from '@/lib/commerce/admin-orders-summary';

export const dynamic = 'force-dynamic';

export const GET = withAdminAuth(async (request, { supabase }) => {
  const cursorOnly = new URL(request.url).searchParams.get('cursor') === '1';

  try {
    if (cursorOnly) {
      return NextResponse.json({ success: true, cursor: await fetchOrdersChangeCursor(supabase) });
    }

    const [summary, cursor] = await Promise.all([
      fetchAdminOrdersSummary(supabase),
      fetchOrdersChangeCursor(supabase),
    ]);

    return NextResponse.json({ success: true, summary, cursor });
  } catch (error: any) {
    console.error('Error building orders summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load order summary' },
      { status: 500 }
    );
  }
});
