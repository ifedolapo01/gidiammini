/** COMMERCE layer — applies an order status change end-to-end: reserves or
 * restores stock as needed, updates the row, and notifies the customer.
 * Shared by the admin's manual status dropdown (app/api/orders/[id]/route.ts)
 * and the change-request approval flow, so both behave identically. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendOrderStatusUpdate } from '@/lib/notifications';
import type { OrderStatus } from '@/types/order';
import { hasStockReserved, formatOrderStatus } from './order-status';
import { applyOrderStockChange } from './order-stock';
import { resolveOrderShippingZone } from './order-shipping-zone';
import { formatZoneEta } from './shipping-eta';

interface ApplyOrderStatusTransitionOptions {
  sendNotification?: boolean;
  notificationMessage?: string;
  paymentVerified?: boolean;
}

interface ApplyOrderStatusTransitionResult {
  success: boolean;
  error?: string;
  status?: number;
  order?: any;
  stockUpdated?: boolean;
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
  const { sendNotification = true, notificationMessage, paymentVerified } = options;

  const { data: currentOrder, error: fetchError } = await supabase
    .from('orders')
    .select(`*, order_items (*)`)
    .eq('id', orderId)
    .single();

  if (fetchError || !currentOrder) {
    return { success: false, error: 'Order not found', status: 404 };
  }

  // Stock is reserved the first time an order moves past 'pending', and
  // restored if a reserved order is cancelled — regardless of which
  // intermediate status (confirmed/rescheduled/shipped/etc.) it was in.
  const hadStockReserved = hasStockReserved(currentOrder.status as OrderStatus);
  const willHaveStockReserved = hasStockReserved(newStatus);

  if (willHaveStockReserved !== hadStockReserved) {
    const { error: stockErrorMessage } = await applyOrderStockChange(supabase, currentOrder, willHaveStockReserved && !hadStockReserved);
    if (stockErrorMessage) {
      return { success: false, error: stockErrorMessage, status: 400 };
    }
  }

  const updateData: any = {
    status: newStatus,
    updated_at: new Date().toISOString()
  };

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
    .insert({ order_id: orderId, status: newStatus, changed_at: updateData.updated_at });
  if (historyError) {
    console.error('Error recording status history:', historyError);
  }

  if (sendNotification) {
    try {
      const estimatedDeliveryText = newStatus === 'confirmed'
        ? await resolveEstimatedDeliveryText(supabase, currentOrder)
        : undefined;

      await sendOrderStatusUpdate({
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

  return {
    success: true,
    order: updatedOrder,
    stockUpdated: willHaveStockReserved !== hadStockReserved
  };
}
