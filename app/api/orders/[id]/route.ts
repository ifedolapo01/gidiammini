// app/api/orders/[id]/route.ts - UPDATED with better stock management
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { sendOrderStatusUpdate } from '@/lib/notifications';
import { verifyAdminAuth } from '@/lib/auth';
import { adjustVariantStockByDelta } from '@/lib/commerce/stock-adjustment';

const VALID_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

async function applyStockChangesForOrder(
  supabase: SupabaseClient,
  currentOrder: any,
  willBeConfirmed: boolean
): Promise<NextResponse | null> {
  const productIds = (currentOrder.order_items || []).map((item: any) => item.product_id);

  if (productIds.length === 0) return null;

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')
    .in('id', productIds);

  if (productsError) {
    return NextResponse.json({ success: false, error: 'Failed to fetch products for stock update.' }, { status: 500 });
  }

  const productUpdates = [];

  for (const product of products || []) {
    const itemsForProduct = currentOrder.order_items.filter((item: any) => item.product_id === product.id);

    const { stock: newStock, pricingConfig } = adjustVariantStockByDelta(
      product.pricing_config,
      product.stock,
      itemsForProduct,
      willBeConfirmed
    );

    if (willBeConfirmed && newStock < 0) {
      return NextResponse.json(
        { success: false, error: `Insufficient stock to confirm order for product: ${product.name}` },
        { status: 400 }
      );
    }

    productUpdates.push({
      id: product.id,
      stock: newStock,
      pricing_config: pricingConfig
    });
  }

  // Apply all updates
  for (const update of productUpdates) {
    await supabase.from('products').update({
      stock: update.stock,
      pricing_config: update.pricing_config
    }).eq('id', update.id);
  }

  return null;
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

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
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

    // Check if we're changing from confirmed to cancelled or vice versa
    const wasConfirmed = currentOrder.status === 'confirmed';
    const willBeConfirmed = status === 'confirmed';
    const willBeCancelled = status === 'cancelled';

    // Update stock based on status changes
    if ((willBeConfirmed && !wasConfirmed) || (willBeCancelled && wasConfirmed)) {
      const stockError = await applyStockChangesForOrder(supabase, currentOrder, willBeConfirmed);
      if (stockError) return stockError;
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
        await sendOrderStatusUpdate({
          orderNumber: currentOrder.order_number,
          customerName: currentOrder.customer_name,
          customerEmail: currentOrder.customer_email,
          customerPhone: currentOrder.customer_phone,
          oldStatus: currentOrder.status,
          newStatus: status,
          customMessage: notificationMessage || `Your order status has been updated to: ${status.toUpperCase()}`
        });
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
      }
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `Order status updated to ${status}`,
      stockUpdated: willBeConfirmed || willBeCancelled
    });

  } catch (error: any) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}
