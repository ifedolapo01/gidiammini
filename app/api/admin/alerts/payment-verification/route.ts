// app/api/admin/alerts/payment-verification/route.ts — how much money is
// waiting to be confirmed.
//
// Two counts, because they are two different jobs. A receipt waiting to be
// verified is a five-second decision somebody can make right now; a part-paid
// order is a customer who has to be chased for a balance. Rolling them into
// one number would put the second kind at the top of a queue it cannot be
// cleared from.
//
// Head-only counts, no rows: the worklist asks for this every two minutes and
// only ever renders the numbers. The rows behind them come from
// /api/admin/worklist/receipts, on expand.
//
// Unlike its neighbours in this folder, this goes through withAdminAuth — the
// route permission table already governs /api/admin/alerts/* and there is no
// reason a new endpoint should check the cookie by hand.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';

export const GET = withAdminAuth(async (_request, { supabase }) => {
  const [awaiting, partPaid] = await Promise.all([
    // A receipt uploaded against an unpaid order: there is an image to look at
    // and a decision to make.
    supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('payment_verified', false)
      .eq('status', 'pending')
      .not('receipt_path', 'is', null),

    // Money in, but not all of it. amount_paid is trigger-maintained, so this
    // needs no join — see migration 20260905180000.
    supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('payment_verified', false)
      .neq('status', 'cancelled')
      .gt('amount_paid', 0),
  ]);

  if (awaiting.error || partPaid.error) {
    console.error(
      'Could not count payments awaiting verification:',
      awaiting.error?.message ?? partPaid.error?.message
    );
    // An empty answer, never an error: one source being down must not blank
    // the rest of the worklist. See app/admin/lib/alert-sources.ts.
    return NextResponse.json({ success: false, pendingCount: 0, partPaidCount: 0 });
  }

  return NextResponse.json({
    success: true,
    pendingCount: awaiting.count ?? 0,
    partPaidCount: partPaid.count ?? 0,
  });
});
