// app/api/orders/route.ts - COMPLETE VERSION
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { OrderData } from '@/types/product';

// GET method - fetch orders (for admin dashboard)
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed', orders: [] },
        { status: 500 }
      );
    }

    // Get status filter from query params
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    
    console.log('Fetching orders with status:', status || 'all');
    
    let query = supabase
      .from('orders')
      .select(`*, order_items (*)`)
      .order('created_at', { ascending: false });

    // Apply status filter if provided
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('Error fetching orders:', error);
      return NextResponse.json(
        { success: false, error: `Failed to fetch orders: ${error.message}`, orders: [] },
        { status: 500 }
      );
    }

    console.log(`✅ Found ${orders?.length || 0} orders`);
    
    return NextResponse.json({ 
      success: true, 
      orders: orders || [] 
    });
    
  } catch (error: any) {
    console.error('Error in orders API:', error);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${error.message}`, orders: [] },
      { status: 500 }
    );
  }
}

// POST method - create new order (for checkout)
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Parse the request body
    const orderData: OrderData = await request.json();
    
    console.log('Creating order:', orderData.order_number);
    
    // Validate required fields
    if (!orderData.order_number || !orderData.customer_name || !orderData.customer_email || !orderData.customer_phone) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: order_number, customer_name, customer_email, customer_phone' },
        { status: 400 }
      );
    }

    // Extract order items from the data
    const { items, ...orderMainData } = orderData;

    // First, create the main order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        ...orderMainData,
        status: 'pending', // Default status
        payment_verified: false // Default payment status
      }])
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return NextResponse.json(
        { success: false, error: `Failed to create order: ${orderError.message}` },
        { status: 500 }
      );
    }

    // Then, create order items if they exist
    if (items && items.length > 0) {
      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        price: item.price,
        quantity: item.quantity,
        size: item.size || null,
        color: item.color || null
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        // Don't fail the whole request if items fail, but log it
        console.warn('Order created but items failed to save');
      }
    }

    console.log(`✅ Order created successfully: ${order.order_number}`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Order created successfully',
      order_id: order.id,
      order_number: order.order_number
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('Error in orders POST API:', error);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}

// Optional: PUT method for updating orders (for admin to update status)
export async function PUT(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const { order_id, status, payment_verified } = await request.json();
    
    if (!order_id) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (payment_verified !== undefined) updateData.payment_verified = payment_verified;
    
    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', order_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating order:', error);
      return NextResponse.json(
        { success: false, error: `Failed to update order: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Order updated successfully',
      order: data
    });
    
  } catch (error: any) {
    console.error('Error in orders PUT API:', error);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}