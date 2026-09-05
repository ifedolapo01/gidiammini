// app/api/admin/payments/queue/route.ts — the orders whose money has not been
// confirmed yet, oldest first.
//
// One query, deliberately: this is the screen a shopkeeper opens on a phone
// first thing in the morning, and every extra round trip is a second of
// staring at a spinner on a mobile connection. The payment rows already
// recorded against each order come back embedded, so a part payment reads as
// "2,000 of 20,000 received" rather than as an unexplained pending order.
//
// FIFO, not newest first. The queue's whole purpose is that nobody waits
// longer than they have to, and a stack sorted newest-first buries whoever has
// already waited longest.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { settlement } from '@/lib/commerce/payment-outcome';

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

const SELECT = `
  id, order_number, customer_name, customer_email, customer_phone,
  total_amount, amount_paid, status, payment_method, payment_verified,
  receipt_path, note, created_at,
  order_payments (
    id, order_id, status, amount, method, reference, received_at,
    reason_code, note, receipt_path, actor_id, actor_email, created_at
  )
`;

export const GET = withAdminAuth(async (request, { supabase }) => {
  const limit = Math.min(
    Number(new URL(request.url).searchParams.get('limit')) || DEFAULT_LIMIT,
    MAX_LIMIT
  );

  const { data, error } = await supabase
    .from('orders')
    .select(SELECT)
    .eq('payment_verified', false)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Could not load the payment queue:', error.message);
    return NextResponse.json(
      { success: false, error: 'Could not load the verification queue.' },
      { status: 500 }
    );
  }

  // A 'paystack' order that was never paid is an abandoned checkout, not a
  // receipt anybody can verify — it belongs in the orders list, not here.
  // It earns a place only once there is something to look at: an uploaded
  // receipt, or money already part-recorded against it.
  const items = (data ?? []).filter(
    (order: any) =>
      order.payment_method !== 'paystack' || order.receipt_path || order.amount_paid > 0
  );

  const withPaymentsNewestFirst = items.map((order: any) => ({
    ...order,
    // amount and amount_paid are Postgres `numeric`. Coerced once, here, so
    // nothing downstream has to wonder whether it is adding money or
    // concatenating strings.
    amount_paid: Number(order.amount_paid ?? 0),
    order_payments: undefined,
    payments: [...(order.order_payments ?? [])]
      .map((payment: any) => ({ ...payment, amount: Number(payment.amount ?? 0) }))
      .sort((a: any, b: any) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()),
  }));

  return NextResponse.json({
    success: true,
    items: withPaymentsNewestFirst,
    summary: {
      waiting: withPaymentsNewestFirst.length,
      /** Has an image to look at — the ones that can actually be worked now. */
      withReceipt: withPaymentsNewestFirst.filter((order: any) => order.receipt_path).length,
      /** Money in, but not enough. Chasing a balance, not verifying a receipt. */
      partPaid: withPaymentsNewestFirst.filter(
        (order: any) => settlement(order.total_amount, order.amount_paid).partial
      ).length,
      /** Nothing to verify yet. Counted so the queue's length is honest about
       *  how much of it is actually actionable. */
      awaitingReceipt: withPaymentsNewestFirst.filter(
        (order: any) => !order.receipt_path && !(order.amount_paid > 0)
      ).length,
      /** Truncated by the limit, so the UI can say so rather than implying
       *  this is everything. */
      capped: (data ?? []).length >= limit,
    },
  });
});
