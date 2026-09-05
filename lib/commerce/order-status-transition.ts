/** COMMERCE layer — applies an order status change end-to-end: reserves or
 * restores stock as needed, updates the row, and notifies the customer.
 * Shared by the admin's manual status dropdown (app/api/orders/[id]/route.ts)
 * and the change-request approval flow, so both behave identically. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendOrderStatusUpdate } from '@/lib/notifications';
import type { DeliveryOutcome } from '@/lib/notifications/delivery';
import type { OrderStatus } from '@/types/order';
import { hasStockReserved, formatOrderStatus } from './order-status';
import { applyOrderStockChange } from './order-stock';
import { inviteReviewIfFulfilled } from './review-invite';
import { resolveOrderShippingZone } from './order-shipping-zone';
import { formatZoneEta } from './shipping-eta';

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

/** Resolves the real delivery ETA text for a 'confirmed' notification, using
 * the order's own stored state/LGA/place so it reflects whatever zone/exception
 * actually applied at checkout — never a hardcoded guess. */
async function resolveEstimatedDeliveryText(supabase: SupabaseClient, order: any): Promise<string | undefined> {
  if (order.delivery_option === 'pickup') {
    return "We'll contact you when your order is ready for pickup";
  }

  const zone = await resolveOrderShippingZone(supabase, order);

  return zone ? `Estimated delivery: ${formatZoneEta(zone)}` : undefined;
}

export async function applyOrderStatusTransition(
  supabase: SupabaseClient,
  orderId: string,
  newStatus: OrderStatus,
  options: ApplyOrderStatusTransitionOptions = {}
): Promise<ApplyOrderStatusTransitionResult> {
  const {
    sendNotification = true, notificationMessage, paymentVerified, actor, reason,
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
    const { error: stockErrorMessage } = await applyOrderStockChange(supabase, currentOrder, willHaveStockReserved);
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
    });
  if (historyError) {
    console.error('Error recording status history:', historyError);
  }

  let delivery: DeliveryOutcome | undefined;

  if (sendNotification) {
    try {
      const estimatedDeliveryText = newStatus === 'confirmed'
        ? await resolveEstimatedDeliveryText(supabase, currentOrder)
        : undefined;

      delivery = await sendOrderStatusUpdate({
        orderNumber: currentOrder.order_number,
        customerName: currentOrder.customer_name,
        customerEmail: currentOrder.customer_email,
        customerPhone: currentOrder.customer_phone,
        oldStatus: currentOrder.status,
        newStatus,
        customMessage: notificationMessage || `Your order status has been updated to: ${formatOrderStatus(newStatus)}`,
        estimatedDeliveryText
      });
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
    }
  }

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
