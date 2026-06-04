// app/api/orders/[id]/route.ts - UPDATED with better stock management
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { sendOrderStatusUpdate } from '@/lib/notifications';
import { verifyAdminAuth } from '@/lib/auth';

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

    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
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
    if (willBeConfirmed && !wasConfirmed) {
      // Reduce stock atomically when confirming order
      const itemsToDecrement = (currentOrder.order_items || [])
        .filter((item: any) => item.product_id)
        .map((item: any) => ({
          product_id: item.product_id,
          quantity: item.quantity
        }));
      
      if (itemsToDecrement.length > 0) {
        const { data: success, error: rpcError } = await supabase.rpc('check_and_decrease_stock_multi', {
          items: itemsToDecrement
        });
        
        if (rpcError || !success) {
          return NextResponse.json(
            { 
              success: false, 
              error: `Insufficient stock to confirm this order. Please verify product inventory.` 
            },
            { status: 400 }
          );
        }
      }
    } else if (willBeCancelled && wasConfirmed) {
      // Restore stock when cancelling a confirmed order
      for (const item of currentOrder.order_items || []) {
        if (item.product_id) {
          await supabase.rpc('increase_product_stock', {
            product_id: item.product_id,
            quantity: item.quantity
          });
        }
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