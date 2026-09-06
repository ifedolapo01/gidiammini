/**
 * Writing down what was sent. Server only.
 *
 * BEST-EFFORT, ALWAYS
 *
 * Nothing in here may fail a send. The message has already left the building
 * by the time this runs, and a logging table having a bad afternoon must not
 * turn a delivered order confirmation into a 500 that the checkout retries —
 * which would send the customer a second one. Every function swallows its own
 * errors to the console and returns.
 *
 * The corollary is that a missing row means "we could not write it down", not
 * "we did not send it". That distinction is why the Admin's timeline says
 * "no record of a message" rather than "nothing was sent".
 *
 * ITS OWN CLIENT
 *
 * Takes no Supabase client. The alternative is threading one through fifteen
 * notification signatures, most of which are called from crons and checkouts
 * that have one for entirely unrelated reasons — and a logging concern that
 * changes the shape of every caller is a logging concern nobody adds.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin-server';
import type { NotificationChannel, DeliveryFailureReason } from './delivery';
import type { NotificationKind } from './kinds';

export type NotificationStatus = 'sent' | 'failed' | 'bounced' | 'delivered' | 'complained';

export interface NotificationEntry {
  channel: NotificationChannel;
  kind: NotificationKind;
  /** The address or number used, as it was at the time. */
  recipient: string;
  status: NotificationStatus;
  subject?: string | null;
  orderId?: string | null;
  customerId?: string | null;
  providerMessageId?: string | null;
  failureReason?: DeliveryFailureReason | null;
  failureDetail?: string | null;
  /** The admin who pressed Resend, if one did. */
  actorId?: string | null;
  /** The row this repeats. */
  resendOf?: string | null;
}

/**
 * Records one attempt. Returns the new row's id, or null if it could not be
 * written — callers use the id only to link a later resend, and a null there
 * costs a link on a timeline rather than anything a customer sees.
 */
export async function recordNotification(entry: NotificationEntry): Promise<string | null> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        channel: entry.channel,
        kind: entry.kind,
        recipient: entry.recipient,
        status: entry.status,
        subject: entry.subject ?? null,
        order_id: entry.orderId ?? null,
        customer_id: entry.customerId ?? null,
        provider_message_id: entry.providerMessageId ?? null,
        failure_reason: entry.failureReason ?? null,
        // Truncated: a nodemailer stack trace against a dead SMTP host runs to
        // kilobytes, and the useful part is the first line.
        failure_detail: entry.failureDetail ? entry.failureDetail.slice(0, 500) : null,
        actor_id: entry.actorId ?? null,
        resend_of: entry.resendOf ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data?.id ?? null;
  } catch (error) {
    // The one place in this file that can happen, and the one thing to do
    // about it. A deployment that has not run 20260906140000 lands here on
    // every send until it does.
    console.error('Could not record notification:', error);
    return null;
  }
}

/**
 * Marks a row as having bounced or been complained about.
 *
 * Nothing calls this yet — SMTP reports neither after the fact. It exists so
 * that adding a provider webhook is a route and a call, not a redesign. See
 * the header of migration 20260906140000.
 */
export async function markNotificationStatus(
  providerMessageId: string,
  status: NotificationStatus,
  detail?: string
): Promise<void> {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('notifications')
      .update({
        status,
        failure_detail: detail ? detail.slice(0, 500) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('provider_message_id', providerMessageId);

    if (error) throw error;
  } catch (error) {
    console.error('Could not update notification status:', error);
  }
}
