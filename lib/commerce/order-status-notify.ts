/**
 * COMMERCE layer — what a status change tells the customer.
 *
 * Split out of order-status-transition.ts, which had grown to hold the stock
 * arithmetic, the row update, the history row, the review invitation *and*
 * every decision about the message. Those are two jobs: one is "make the
 * change correctly", the other is "say the right thing about it", and the
 * second one changes far more often than the first.
 *
 * Everything here is best-effort by construction. A notification that fails
 * must never fail the transition it describes — the order really has moved,
 * and refusing the change because an SMS gateway was down would be worse than
 * a customer who has to check the tracking page.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendOrderStatusUpdate } from '@/lib/notifications';
import type { DeliveryOutcome } from '@/lib/notifications/delivery';
import type { OrderStatus } from '@/types/order';
import { formatOrderStatus } from './order-status';
import { cancellationMessage } from './cancellation-reasons';
import type { OrderTracking } from './order-tracking';
import { resolveOrderShippingZone } from './order-shipping-zone';
import { formatZoneEta } from './shipping-eta';

/** Resolves the real delivery ETA text for a 'confirmed' notification, using
 * the order's own stored state/LGA/place so it reflects whatever zone/exception
 * actually applied at checkout — never a hardcoded guess. */
async function resolveEstimatedDeliveryText(
  supabase: SupabaseClient,
  order: any
): Promise<string | undefined> {
  if (order.delivery_option === 'pickup') {
    return "We'll contact you when your order is ready for pickup";
  }

  const zone = await resolveOrderShippingZone(supabase, order);

  return zone ? `Estimated delivery: ${formatZoneEta(zone)}` : undefined;
}

/**
 * What the customer is told when the caller did not write the message itself.
 *
 * A cancellation with a ground gets that ground's sentence, which is the whole
 * point of having a vocabulary: "Your order status has been updated to:
 * Cancelled" tells someone who has paid money absolutely nothing.
 */
export function defaultStatusMessage(
  newStatus: OrderStatus,
  reasonCode?: string | null,
  reason?: string | null
): string {
  if (newStatus === 'cancelled') {
    return cancellationMessage(reasonCode, reason);
  }
  return `Your order status has been updated to: ${formatOrderStatus(newStatus)}`;
}

/**
 * The tracking to put in a 'shipped' notification.
 *
 * Prefers what this transition supplied, then whatever the order already
 * carries — an order can pick up a courier from an earlier edit and then be
 * marked shipped with no new details, and the email should still say who has
 * the parcel. Null for every other status.
 */
export function trackingForNotification(
  newStatus: OrderStatus,
  supplied: OrderTracking | null,
  order: { carrier?: string | null; tracking_number?: string | null; tracking_url?: string | null }
): Partial<OrderTracking> | null {
  if (newStatus !== 'shipped') return null;

  return supplied ?? {
    carrier: order.carrier ?? null,
    trackingNumber: order.tracking_number ?? null,
    trackingUrl: order.tracking_url ?? null,
  };
}

export interface StatusNotificationInput {
  order: any;
  newStatus: OrderStatus;
  /** The admin's own message, where they wrote one. */
  notificationMessage?: string;
  reason?: string | null;
  reasonCode?: string | null;
  /** Tracking captured by this transition, if any. */
  shipment: OrderTracking | null;
}

/**
 * Tells the customer, and reports which channels actually reached them.
 *
 * Returns undefined rather than throwing on failure: see the header. The
 * caller's own result already distinguishes "no notification asked for" from
 * "asked for and this is what happened".
 */
export async function notifyStatusChange(
  supabase: SupabaseClient,
  input: StatusNotificationInput
): Promise<DeliveryOutcome | undefined> {
  const { order, newStatus, notificationMessage, reason, reasonCode, shipment } = input;

  try {
    const estimatedDeliveryText = newStatus === 'confirmed'
      ? await resolveEstimatedDeliveryText(supabase, order)
      : undefined;

    return await sendOrderStatusUpdate({
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      oldStatus: order.status,
      newStatus,
      customMessage: notificationMessage || defaultStatusMessage(newStatus, reasonCode, reason),
      estimatedDeliveryText,
      tracking: trackingForNotification(newStatus, shipment, order),
    });
  } catch (notificationError) {
    console.error('Notification error:', notificationError);
    return undefined;
  }
}
