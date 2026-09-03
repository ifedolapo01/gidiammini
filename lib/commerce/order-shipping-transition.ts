/** COMMERCE layer — applies a shipping-method change to an order: validates
 * the target zone, updates the order's delivery fields, and notifies the
 * customer. Shared by the admin's manual override
 * (app/api/orders/[id]/shipping/route.ts) and the change-request approval flow. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendCustomNotification } from '@/lib/notifications';
import type { DeliveryOutcome } from '@/lib/notifications/delivery';
import { formatZoneEta } from './shipping-eta';

interface ApplyOrderShippingTransitionParams {
  shippingZoneId: string;
  deliveryOption: 'pickup' | 'delivery';
  /** Only relevant (and only applied) when deliveryOption is 'delivery'. */
  deliveryAddress?: string;
  city?: string;
}

interface ApplyOrderShippingTransitionResult {
  success: boolean;
  error?: string;
  status?: number;
  order?: any;
  /** The shipping fields as they were before the override, for the audit trail. */
  previous?: Record<string, unknown>;
  delivery?: DeliveryOutcome;
}

export async function applyOrderShippingTransition(
  supabase: SupabaseClient,
  orderId: string,
  { shippingZoneId, deliveryOption, deliveryAddress, city }: ApplyOrderShippingTransitionParams
): Promise<ApplyOrderShippingTransitionResult> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return { success: false, error: 'Order not found', status: 404 };
  }

  const { data: zone, error: zoneError } = await supabase
    .from('shipping_zones')
    .select('*')
    .eq('id', shippingZoneId)
    .single();

  if (zoneError || !zone) {
    return { success: false, error: 'Shipping zone not found', status: 404 };
  }

  if (deliveryOption === 'pickup' && !zone.pickup_available) {
    return { success: false, error: `${zone.name} does not offer pickup`, status: 400 };
  }

  const updateData: any = {
    shipping_zone_id: zone.id,
    selected_state: zone.state,
    selected_lga: zone.lga,
    selected_place: null,
    delivery_option: deliveryOption,
    updated_at: new Date().toISOString(),
  };

  if (deliveryOption === 'delivery') {
    if (deliveryAddress) updateData.delivery_address = deliveryAddress;
    if (city) updateData.city = city;
  }

  const { data: updatedOrder, error: updateError } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select()
    .single();

  if (updateError) {
    return { success: false, error: `Database error: ${updateError.message}`, status: 500 };
  }

  const shippingSummary = deliveryOption === 'pickup'
    ? `Pickup from ${zone.pickup_address}`
    : `${zone.delivery_label} to ${zone.name} (${formatZoneEta(zone)})`;

  let delivery: DeliveryOutcome | undefined;
  try {
    delivery = await sendCustomNotification({
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      message: `Your shipping method has been updated: ${shippingSummary}`,
      viaEmail: true,
      viaSMS: true,
    });
  } catch (notificationError) {
    console.error('Shipping update notification error:', notificationError);
  }

  return {
    success: true,
    order: updatedOrder,
    previous: {
      shipping_zone_id: order.shipping_zone_id,
      delivery_option: order.delivery_option,
      delivery_address: order.delivery_address,
      city: order.city,
      total_amount: order.total_amount,
    },
    delivery,
  };
}
