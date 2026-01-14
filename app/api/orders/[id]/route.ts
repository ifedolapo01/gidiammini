// app/api/orders/[id]/route.ts - UPDATED WITH PAYMENT VERIFICATION
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { sendOrderStatusUpdate } from '@/lib/notifications';

// IMPORTANT: Use this exact function signature
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In Next.js 14/15, params is a Promise - we need to await it
    const { id } = await params;
    const orderId = id;
    
    console.log('PUT request - Order ID from params:', orderId);
    
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Parse the request body
    const body = await request.json();
    const { 
      status, 
      sendNotification: shouldSendNotification = true, 
      notificationMessage,
      payment_verified // Optional: allow manual override
    } = body;
    
    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Status is required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Create admin client
    const supabase = createAdminClient();
    
    // Prepare update data
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };
    
    // If payment_verified is explicitly provided, use it
    if (payment_verified !== undefined) {
      updateData.payment_verified = payment_verified;
    }
    // If status is 'confirmed' and payment_verified is not already true, set it to true
    else if (status === 'confirmed') {
      // First, check the current payment status
      const { data: currentOrder } = await supabase
        .from('orders')
        .select('payment_verified')
        .eq('id', orderId)
        .single();
      
      // Only update to true if not already true
      if (!currentOrder?.payment_verified) {
        updateData.payment_verified = true;
        console.log('Auto-setting payment_verified to true for confirmed order');
      }
    }

    // Update the order
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
        // Get the order details for notification
        const { data: order } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();
        
        if (order) {
          // Include payment info in notification if relevant
          let customNote = notificationMessage;
          if (!notificationMessage && status === 'confirmed' && updateData.payment_verified) {
            customNote = 'Your order has been confirmed and payment has been verified.';
          }
          
          await sendOrderStatusUpdate({
            orderNumber: order.order_number,
            customerName: order.customer_name,
            customerEmail: order.customer_email,
            customerPhone: order.customer_phone,
            oldStatus: order.status,
            newStatus: status,
            customMessage: customNote || `Your order status has been updated to: ${status.toUpperCase()}`
          });
        }
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
        // Don't fail if notification fails
      }
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `Order status updated to ${status}`,
      ...(updateData.payment_verified && { paymentVerified: true })
    });

  } catch (error: any) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}

// Also handle GET
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = id;
    
    const supabase = createAdminClient();
    
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order
    });
  } catch (error: any) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}