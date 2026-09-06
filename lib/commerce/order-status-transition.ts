/** COMMERCE layer — applies an order status change end-to-end: reserves or
 * restores stock as needed, updates the row, and notifies the customer.
 * Shared by the admin's manual status dropdown (app/api/orders/[id]/route.ts)
 * and the change-request approval flow, so both behave identically. */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DeliveryOutcome } from '@/lib/notifications/delivery';
import type { OrderStatus } from '@/types/order';
import { hasStockReserved } from './order-status';
import { resolveTrackingFields, type OrderTracking } from './order-tracking';
import { notifyStatusChange } from './order-status-notify';
import { applyOrderStockChange } from './order-stock';
import { inviteReviewIfFulfilled } from './review-invite';

/** Who made a change, for the order's own timeline. Deliberately not the full
 * AdminActor: this module is Commerce and has no business importing the admin
 * session, and the two fields below are all order_status_history records. */
export interface StatusChangeActor {
  id: string;
  email: string | null;
}

interface ApplyOrderStatusTransitionOptions {
  sendNotification?: boolean;
  notificationMessage?: string;
  paymentVerified?: boolean;
  /**
   * The admin behind this transition, when there is one.
   *
   * Left out by every system path — checkout, the reservation sweep, a payment
   * webhook — so those entries read as "System" rather than being attributed
   * to whoever happened to be signed in. A wrong name on a cancellation is
   * worse than no name.
   */
  actor?: StatusChangeActor | null;
  /** Why, in the admin's words. The answer to "why was this cancelled?", kept
   * on the timeline itself rather than only in the audit trail. */
  reason?: string | null;
  /**
   * The same answer from a fixed vocabulary (cancellation-reasons.ts), so it
   * can be counted. Free text says why this one died; the code is what makes
   * "why do orders die here" answerable at all.
   */
  reasonCode?: string | null;
  /**
   * Courier and waybill, collected when an order is marked shipped.
   *
   * Written onto the order and carried into the notification, so the "your
   * order has shipped" message can finally say how to follow the parcel. Any
   * other status ignores it: a tracking number on a cancellation is a mistake,
   * not a fact.
   */
  tracking?: Partial<OrderTracking> | null;
}

interface ApplyOrderStatusTransitionResult {
  success: boolean;
  error?: string;
  status?: number;
  order?: any;
  /** The status this order held before the change, for the audit trail. */
  previousStatus?: string;
  stockUpdated?: boolean;
  /** Which channels the customer was actually reached on. Undefined when the
   * caller asked for no notification. */
  delivery?: DeliveryOutcome;
}

export async function applyOrderStatusTransition(
  supabase: SupabaseClient,
  orderId: string,
  newStatus: OrderStatus,
  options: ApplyOrderStatusTransitionOptions = {}
): Promise<ApplyOrderStatusTransitionResult> {
  const {
    sendNotification = true, notificationMessage, paymentVerified, actor, reason,
    reasonCode, tracking,
  } = options;

  const { data: currentOrder, error: fetchError } = await supabase
    .from('orders')
    .select(`*, order_items (*)`)
    .eq('id', orderId)
    .single();

  if (fetchError || !currentOrder) {
    return { success: false, error: 'Order not found', status: 404 };
  }

  // Whether stock is *currently* held comes from the order's own
  // stock_reserved column, never inferred from its status. Orders created
  // after the reservation migration claim stock at checkout, while pre-existing
  // 'pending' rows never did — only an explicit flag can tell those apart, and
  // guessing either way would double-decrement or release stock never taken.
  const hadStockReserved = currentOrder.stock_reserved === true;
  const willHaveStockReserved = hasStockReserved(newStatus);

  const updateData: any = {
    status: newStatus,
    updated_at: new Date().toISOString()
  };

  if (willHaveStockReserved !== hadStockReserved) {
    // The actor travels with the movement: "who put those 3 back on the
    // shelf" is the same question as "who cancelled that order", and the
    // ledger should not send somebody to the activity feed to answer it.
    const { error: stockErrorMessage } = await applyOrderStockChange(
      supabase,
      currentOrder,
      willHaveStockReserved,
      { actorId: actor?.id ?? null }
    );
    if (stockErrorMessage) {
      return { success: false, error: stockErrorMessage, status: 400 };
    }
    updateData.stock_reserved = willHaveStockReserved;
  }

  // Only 'pending' orders are ever swept for an expired reservation, so once an
  // order leaves that status the deadline is meaningless — clear it rather than
  // leave a stale timestamp on the row.
  if (newStatus !== 'pending' && currentOrder.reserved_until) {
    updateData.reserved_until = null;
  }

  if (paymentVerified !== undefined) {
    updateData.payment_verified = paymentVerified;
  } else if (newStatus === 'confirmed') {
    updateData.payment_verified = true;
  }

  // Only on the transition that earns it. Passing tracking with any other
  // status is a caller bug rather than an instruction, and silently honouring
  // it would put a waybill on a cancelled order.
  const shipment = newStatus === 'shipped' && tracking ? resolveTrackingFields(tracking) : null;

  if (shipment) {
    updateData.carrier = shipment.carrier;
    updateData.tracking_number = shipment.trackingNumber;
    updateData.tracking_url = shipment.trackingUrl;
  }

  const { data: updatedOrder, error: updateError } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating order:', updateError);
    return { success: false, error: `Database error: ${updateError.message}`, status: 500 };
  }

  // Best-effort: a missed history row never blocks the actual status change.
  const { error: historyError } = await supabase
    .from('order_status_history')
    .insert({
      order_id: orderId,
      status: newStatus,
      changed_at: updateData.updated_at,
      actor_id: actor?.id ?? null,
      actor_email: actor?.email ?? null,
      reason: reason ?? null,
      reason_code: reasonCode ?? null,
    });
  if (historyError) {
    console.error('Error recording status history:', historyError);
  }

  const delivery: DeliveryOutcome | undefined = sendNotification
    ? await notifyStatusChange(supabase, {
        order: currentOrder,
        newStatus,
        notificationMessage,
        reason,
        reasonCode,
        shipment,
      })
    : undefined;

  // The review invitation, on the transition that earns it. A fulfilled order
  // is the only source of a review this shop will ever have, and asking is not
  // something anyone should have to remember to do. Best-effort and one per
  // order — see review-invite.ts.
  await inviteReviewIfFulfilled(supabase, currentOrder, currentOrder.status, newStatus);

  return {
    success: true,
    order: updatedOrder,
    previousStatus: currentOrder.status,
    stockUpdated: willHaveStockReserved !== hadStockReserved,
    delivery
  };
}
