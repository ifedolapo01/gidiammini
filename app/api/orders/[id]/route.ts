// app/api/orders/[id]/route.ts - UPDATED with better stock management
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { sendOrderStatusUpdate } from '@/lib/notifications';
import { verifyAdminAuth } from '@/lib/auth';
import { ORDER_STATUSES, hasStockReserved, formatOrderStatus } from '@/lib/commerce/order-status';
import { applyOrderStockChange } from '@/lib/commerce/order-stock';
import { findShippingZone } from '@/lib/commerce/checkout';
import { formatZoneEta } from '@/lib/commerce/shipping-eta';
import type { OrderStatus } from '@/types/order';

/** Resolves the real delivery ETA text for a 'confirmed' notification, using
 * the order's own stored state/LGA/place so it reflects whatever zone/exception
 * actually applied at checkout — never a hardcoded guess. */
async function resolveEstimatedDeliveryText(supabase: SupabaseClient, order: any): Promise<string | undefined> {
  if (order.delivery_option === 'pickup') {
    return "We'll contact you when your order is ready for pickup";
  }

  const { data: zones } = await supabase.from('shipping_zones').select('*, shipping_zone_exceptions(*)');
  const zone = findShippingZone(zones || [], order.selected_state, order.selected_lga, order.selected_place);

  return zone ? `Estimated delivery: ${formatZoneEta(zone)}` : undefined;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const orderId = id;

    const body = await request.json();
    const {
      status,
      sendNotification: shouldSendNotification = true,
      notificationMessage,
      payment_verified
    } = body;

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Status is required' },
        { status: 400 }
      );
    }

    if (!ORDER_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${ORDER_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // First, get the current order with items
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('id', orderId)
      .single();

    if (fetchError || !currentOrder) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Stock is reserved the first time an order moves past 'pending', and
    // restored if a reserved order is cancelled — regardless of which
    // intermediate status (confirmed/rescheduled/shipped/etc.) it was in.
    const hadStockReserved = hasStockReserved(currentOrder.status as OrderStatus);
    const willHaveStockReserved = hasStockReserved(status as OrderStatus);

    if (willHaveStockReserved !== hadStockReserved) {
      const { error: stockErrorMessage } = await applyOrderStockChange(supabase, currentOrder, willHaveStockReserved && !hadStockReserved);
      if (stockErrorMessage) {
        return NextResponse.json({ success: false, error: stockErrorMessage }, { status: 400 });
      }
    }

    // Update the order status
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (payment_verified !== undefined) {
      updateData.payment_verified = payment_verified;
    } else if (status === 'confirmed') {
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
      return NextResponse.json(
        { success: false, error: `Database error: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Send notification
    if (shouldSendNotification) {
      try {
        const estimatedDeliveryText = status === 'confirmed'
          ? await resolveEstimatedDeliveryText(supabase, currentOrder)
          : undefined;

        await sendOrderStatusUpdate({
          orderNumber: currentOrder.order_number,
          customerName: currentOrder.customer_name,
          customerEmail: currentOrder.customer_email,
          customerPhone: currentOrder.customer_phone,
          oldStatus: currentOrder.status,
          newStatus: status,
          customMessage: notificationMessage || `Your order status has been updated to: ${formatOrderStatus(status)}`,
          estimatedDeliveryText
        });
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
      }
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `Order status updated to ${formatOrderStatus(status)}`,
      stockUpdated: willHaveStockReserved !== hadStockReserved
    });

  } catch (error: any) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}
