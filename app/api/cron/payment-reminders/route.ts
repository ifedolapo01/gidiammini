// app/api/cron/payment-reminders/route.ts - reassures customers whose order
// has sat in 'pending' a while after checkout, i.e. admin hasn't verified
// their already-uploaded receipt yet (checkout requires a receipt before an
// order is even created, so 'pending' never means "hasn't paid"). Sent at
// most once per order (payment_reminder_sent_at), by email only — customers
// aren't required to have an account to check order status.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { authorizeCron } from '@/lib/api/cron-auth';
import { sendOrderEmail } from '@/lib/email';
import { buildPaymentReminderEmail } from '@/lib/notifications/templates/payment-reminder-email';

export const maxDuration = 300;

/** How long an order can sit awaiting verification before the customer gets a reminder. */
const REMINDER_DELAY_HOURS = 24;

export async function GET(req: NextRequest) {
  const denied = authorizeCron(req, { jobName: 'the payment-reminder job' });
  if (denied) return denied;

  try {
    const supabase = createAdminClient();

    const cutoff = new Date(Date.now() - REMINDER_DELAY_HOURS * 60 * 60 * 1000).toISOString();

    const { data: unpaidOrders, error } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, customer_email, total_amount')
      .eq('status', 'pending')
      .eq('payment_verified', false)
      // Transfer orders only. This email tells somebody to send money to an
      // account number and upload a receipt, which is the wrong instruction
      // for an order that was started at the payment provider — they either
      // paid (and the webhook confirmed it) or abandoned the attempt, and
      // neither is fixed by a receipt.
      .eq('payment_method', 'transfer')
      .is('payment_reminder_sent_at', null)
      .lte('created_at', cutoff);

    if (error) throw error;

    if (!unpaidOrders || unpaidOrders.length === 0) {
      return NextResponse.json({ success: true, message: 'No unpaid orders due for a reminder.' });
    }

    let remindersSent = 0;

    for (const order of unpaidOrders) {
      if (!order.customer_email) continue;

      const { subject, html } = buildPaymentReminderEmail({
        orderNumber: order.order_number,
        customerName: order.customer_name,
        totalAmount: order.total_amount,
      });

      const result = await sendOrderEmail(order.customer_email, subject, html);

      // Mark as reminded even if delivery failed (e.g. bad address) so a
      // permanently-broken email doesn't get retried forever every run.
      await supabase
        .from('orders')
        .update({ payment_reminder_sent_at: new Date().toISOString() })
        .eq('id', order.id);

      if (result.success) remindersSent++;
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${remindersSent} of ${unpaidOrders.length} payment reminders.`,
    });
  } catch (error: any) {
    console.error('Payment reminder cron error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
