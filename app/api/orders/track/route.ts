// app/api/orders/track/route.ts - public order lookup for customers.
// Requires the order number AND the email/phone used at checkout, so an order
// number alone (guessable — it's just "UT" + a timestamp) can't be used to
// view someone else's name, address, and items.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifyOrderContact } from '@/lib/commerce/order-lookup';

const NOT_FOUND_MESSAGE = "We couldn't find an order matching that order number and email/phone.";

export async function POST(request: NextRequest) {
  try {
    const { orderNumber, contact } = await request.json();

    if (!orderNumber?.trim() || !contact?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Order number and email or phone are required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Customers often paste the order number as shown on the confirmation
    // page/email, "#UT12345678" — strip a leading '#' so that still matches.
    const normalizedOrderNumber = orderNumber.trim().replace(/^#/, '');

    const { data: order, error } = await supabase
      .from('orders')
      .select(`*, order_items (*), order_change_requests (*)`)
      .eq('order_number', normalizedOrderNumber)
      .single();

    if (error || !order || !verifyOrderContact(order, contact)) {
      return NextResponse.json({ success: false, error: NOT_FOUND_MESSAGE }, { status: 404 });
    }

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error('Error tracking order:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
