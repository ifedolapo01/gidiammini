// app/api/orders/[id]/notify/route.ts - sends an ad-hoc message about one
// order to its customer. Called only from the admin orders view.
//
// SECURITY: this route used to be completely unauthenticated. Anyone holding an
// order's UUID could send arbitrary text to that customer's email and phone,
// from the store's own address — and /api/orders/track returns the id to
// whoever can look an order up. It is admin-only now.
import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { sendCustomNotification } from '@/lib/notifications';
import type { SupabaseClient } from '@supabase/supabase-js';

async function notifyOrderCustomer(
  supabase: SupabaseClient,
  request: NextRequest,
  orderId: string
) {
  try {
    
    const body = await request.json();
    const { message, viaEmail = true, viaSMS = true } = body;
    
    if (!message?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const result = await sendCustomNotification({
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      message: message.trim(),
      viaEmail,
      viaSMS
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification sent successfully',
      channels: result.channels
    });

  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

export const POST = withAdminAuth(async (request, { supabase, params }) => {
  const { id } = await params;
  return notifyOrderCustomer(supabase, request, id);
});
