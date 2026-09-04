/**
 * COMMERCE layer — the two things that happen after an order row exists:
 * its opening status-history entry, and the confirmation email to the buyer.
 *
 * Both are deliberately best-effort. By the time this runs the order is
 * written, its stock is claimed, and the customer already has their order
 * number on screen — so neither a missed history row nor a mail server having
 * a bad afternoon is worth failing the request over. Each failure is logged
 * and swallowed.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendOrderReceivedEmail } from '@/lib/notifications';
import { INITIAL_ORDER_STATUS } from './order-status';
import { markCartRecovered } from './abandoned-cart-query';

interface OrderCreatedEffectsParams {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
}

export async function runOrderCreatedEffects(
  supabase: SupabaseClient,
  { orderId, orderNumber, customerName, customerEmail }: OrderCreatedEffectsParams
): Promise<void> {
  const { error: historyError } = await supabase
    .from('order_status_history')
    .insert({ order_id: orderId, status: INITIAL_ORDER_STATUS, changed_at: new Date().toISOString() });

  if (historyError) {
    console.error('Error recording initial status history:', historyError);
  }

  try {
    await sendOrderReceivedEmail({ orderNumber, customerName, customerEmail });
  } catch (notificationError) {
    console.error('Order-received email error:', notificationError);
  }

  // They bought, so the abandoned-cart sequence is over. Here rather than in
  // the cron's guard because the reminder must not be able to arrive after the
  // thing it is reminding them to do — and like everything else in this file,
  // it cannot fail the order.
  try {
    await markCartRecovered(supabase, customerEmail);
  } catch (recoveryError) {
    console.error('Marking the abandoned cart recovered failed:', recoveryError);
  }
}
