/**
 * COMMERCE layer (server only) — asking for the review.
 *
 * Fires off the order status transition that already exists: the moment an
 * order reaches a fulfilled state, the person who paid for it is the one
 * person qualified to say whether it was worth it. Waiting for them to think
 * of it unprompted is how a shop ends up with no reviews.
 *
 * The three rules are the ones lib/commerce/stock-alerts.ts runs on, for the
 * same reasons:
 *
 *   1. Only a transition into a fulfilled status fires. Both fulfilled
 *      statuses count — a pickup order that reached 'picked_up' is as
 *      delivered as a delivery order that reached 'delivered', and inviting
 *      only one of them would silently exclude every pickup customer.
 *   2. The invite row is claimed before the mail is sent. One row per order
 *      means a second delivered transition (a correction, a re-save) cannot
 *      produce a second email.
 *   3. Nothing here can fail the status change. The admin's instruction has
 *      already committed; a mail server having a bad afternoon must not turn
 *      that into an error they retry.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendOrderEmail } from '@/lib/email';
import { buildReviewInviteEmail } from '@/lib/notifications/templates/review-invite-email';
import { absoluteUrl } from '@/lib/site-url';
import { hashReviewToken, newReviewToken } from './review-token';
import type { OrderStatus } from '@/types/order';

/** The statuses that mean the customer has the goods in their hands. */
export const REVIEW_INVITE_STATUSES: OrderStatus[] = ['delivered', 'picked_up'];

export interface ReviewInviteResult {
  /** False when nothing was attempted: wrong transition, or already invited. */
  invited: boolean;
  sent: boolean;
  reason?: string;
}

const NOT_INVITED: ReviewInviteResult = { invited: false, sent: false };

const UNIQUE_VIOLATION = '23505';

interface InvitableOrder {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string | null;
}

export function reviewUrl(token: string): string {
  return absoluteUrl(`/review/${token}`);
}

/**
 * Claims the invite row and returns the plaintext token to mail.
 *
 * Null means somebody already has an invite for this order and it was sent —
 * so there is nothing to do. A row that exists but was never sent (the mail
 * failed last time) is re-issued with a fresh token: only the hash was ever
 * stored, so the old token is not a credential anybody holds, and the
 * alternative is a customer who is permanently uninvitable because one send
 * failed once.
 */
async function claimInvite(supabase: SupabaseClient, orderId: string): Promise<string | null> {
  const token = newReviewToken();
  const token_hash = hashReviewToken(token);

  const { error } = await supabase
    .from('order_review_invites')
    .insert({ order_id: orderId, token_hash });

  if (!error) return token;

  if (error.code !== UNIQUE_VIOLATION) {
    console.error(`Review invite claim failed for order ${orderId}:`, error.message);
    return null;
  }

  const { data: existing } = await supabase
    .from('order_review_invites')
    .select('sent_at')
    .eq('order_id', orderId)
    .maybeSingle();

  // Already invited and the mail went out. One ask per order.
  if (!existing || (existing as { sent_at: string | null }).sent_at) return null;

  const { error: reissueError } = await supabase
    .from('order_review_invites')
    .update({ token_hash })
    .eq('order_id', orderId)
    .is('sent_at', null);

  if (reissueError) {
    console.error(`Review invite re-issue failed for order ${orderId}:`, reissueError.message);
    return null;
  }

  return token;
}

async function productNamesFor(supabase: SupabaseClient, orderId: string): Promise<string[]> {
  const { data } = await supabase
    .from('order_items')
    .select('product_name')
    .eq('order_id', orderId);

  return [...new Set(((data ?? []) as Array<{ product_name: string }>).map((row) => row.product_name))];
}

/** Sends the invite for an order that has just been fulfilled. */
export async function sendReviewInvite(
  supabase: SupabaseClient,
  order: InvitableOrder
): Promise<ReviewInviteResult> {
  if (!order.customer_email) return { invited: false, sent: false, reason: 'no_recipient' };

  const token = await claimInvite(supabase, order.id);
  if (!token) return NOT_INVITED;

  const { subject, html } = buildReviewInviteEmail({
    orderNumber: order.order_number,
    customerName: order.customer_name || 'there',
    reviewUrl: reviewUrl(token),
    productNames: await productNamesFor(supabase, order.id),
  });

  const outcome = await sendOrderEmail(order.customer_email, subject, html);

  if (!outcome.success) {
    // sent_at stays null, which is what makes the next fulfilled transition
    // re-issue rather than skip.
    console.error(`Review invite email failed for order ${order.id}: ${outcome.reason}`);
    return { invited: true, sent: false, reason: outcome.reason };
  }

  const { error } = await supabase
    .from('order_review_invites')
    .update({ sent_at: new Date().toISOString() })
    .eq('order_id', order.id);

  if (error) {
    // The mail is already gone. Recording that it went is best-effort; the
    // worst case is one duplicate ask if the order is re-delivered.
    console.error(`Marking review invite sent failed for order ${order.id}:`, error.message);
  }

  return { invited: true, sent: true };
}

/**
 * The wrapper applyOrderStatusTransition calls: checks the transition, then
 * invites. Swallows everything — see rule 3.
 */
export async function inviteReviewIfFulfilled(
  supabase: SupabaseClient,
  order: InvitableOrder,
  previousStatus: string | null | undefined,
  newStatus: OrderStatus
): Promise<ReviewInviteResult> {
  if (!REVIEW_INVITE_STATUSES.includes(newStatus)) return NOT_INVITED;
  // A re-save that does not change the status is not a fulfilment event. The
  // one-row-per-order rule would catch it anyway; this saves the round trip.
  if (previousStatus === newStatus) return NOT_INVITED;

  try {
    return await sendReviewInvite(supabase, order);
  } catch (cause) {
    console.error(`Review invite failed for order ${order.id}:`, cause);
    return NOT_INVITED;
  }
}
