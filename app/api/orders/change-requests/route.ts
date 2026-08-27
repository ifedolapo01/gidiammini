// app/api/orders/change-requests/route.ts - customer-submitted reschedule /
// delivery-method-change requests. Trust model matches /api/orders/track:
// order number + email/phone, never auth — every request still needs the
// seller's explicit approve/reject before it takes effect.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifyOrderContact } from '@/lib/commerce/order-lookup';
import { canRequestOrderChange, canCancelOrder } from '@/lib/commerce/order-status';
import { asOrderStatus } from '@/lib/commerce/db-narrowing';
import { resolveOrderShippingZone } from '@/lib/commerce/order-shipping-zone';
import { sendOrderEmail } from '@/lib/email';
import { escapeHtml, escapeHtmlWithBreaks, sanitizeHeader } from '@/lib/notifications/escape-html';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import type { OrderChangeRequestType } from '@/types/orderChangeRequest';

const REQUEST_TYPES: OrderChangeRequestType[] = ['reschedule', 'delivery_method_change', 'cancel'];

function validateDetails(requestType: OrderChangeRequestType, details: any): string | null {
  if (requestType === 'reschedule') {
    return details?.preferredDate ? null : 'A preferred date is required';
  }

  if (requestType === 'cancel') {
    return null;
  }

  if (!['pickup', 'delivery'].includes(details?.newDeliveryOption)) {
    return "newDeliveryOption must be 'pickup' or 'delivery'";
  }
  if (details.newDeliveryOption === 'delivery' && (!details.deliveryAddress?.trim() || !details.city?.trim())) {
    return 'A delivery address and city are required';
  }
  return null;
}

async function notifyOwner(order: any, requestType: OrderChangeRequestType, details: any, customerNote?: string) {
  // details.preferredDate is customer-supplied free text; newDeliveryOption is
  // validated against a fixed pair but escaped anyway so the rule is uniform.
  const summary = requestType === 'reschedule'
    ? `reschedule to ${escapeHtml(details.preferredDate)}`
    : requestType === 'cancel'
    ? 'cancel their order'
    : `switch to ${escapeHtml(details.newDeliveryOption)}`;

  await sendOrderEmail(
    process.env.STORE_OWNER_EMAIL || 'ifedolapoajayi0@gmail.com',
    sanitizeHeader(`Order change request: #${order.order_number}`),
    `<p>${escapeHtml(order.customer_name)} (${escapeHtml(order.customer_email || order.customer_phone)}) ` +
      `requested a ${summary} for order #${escapeHtml(order.order_number)}.</p>` +
      (customerNote ? `<p>Note: ${escapeHtmlWithBreaks(customerNote)}</p>` : '') +
      `<p>Review it in the admin dashboard.</p>`
  );
}

async function submitChangeRequest(request: NextRequest) {
  try {
    const { orderNumber, contact, requestType, details, customerNote } = await request.json();

    if (!orderNumber?.trim() || !contact?.trim() || !REQUEST_TYPES.includes(requestType)) {
      return NextResponse.json(
        { success: false, error: 'Order number, contact, and a valid request type are required' },
        { status: 400 }
      );
    }

    const detailsError = validateDetails(requestType, details);
    if (detailsError) {
      return NextResponse.json({ success: false, error: detailsError }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, order_change_requests (*)')
      .eq('order_number', orderNumber.trim())
      .single();

    if (error || !order || !verifyOrderContact(order, contact)) {
      return NextResponse.json(
        { success: false, error: "We couldn't find an order matching that order number and email/phone." },
        { status: 404 }
      );
    }

    const orderStatus = asOrderStatus(order.status);
    const isEligible = requestType === 'cancel' ? canCancelOrder(orderStatus) : canRequestOrderChange(orderStatus);
    if (!isEligible) {
      const error = requestType === 'cancel' ? 'This order can no longer be cancelled.' : 'This order can no longer be changed.';
      return NextResponse.json({ success: false, error }, { status: 400 });
    }

    if (order.order_change_requests?.some((r: any) => r.status === 'pending')) {
      return NextResponse.json(
        { success: false, error: 'You already have a pending request for this order.' },
        { status: 400 }
      );
    }

    if (requestType === 'delivery_method_change') {
      if (details.newDeliveryOption === order.delivery_option) {
        return NextResponse.json(
          { success: false, error: `Your order is already set to ${details.newDeliveryOption}.` },
          { status: 400 }
        );
      }
      if (details.newDeliveryOption === 'pickup') {
        const zone = await resolveOrderShippingZone(supabase, order);
        if (!zone?.pickup_available) {
          return NextResponse.json(
            { success: false, error: 'Pickup is not available for your location.' },
            { status: 400 }
          );
        }
      }
    }

    const { data: changeRequest, error: insertError } = await supabase
      .from('order_change_requests')
      .insert({
        order_id: order.id,
        request_type: requestType,
        details,
        customer_note: customerNote || null,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ success: false, error: `Database error: ${insertError.message}` }, { status: 500 });
    }

    try {
      await notifyOwner(order, requestType, details, customerNote);
    } catch (emailError) {
      console.error('Change request owner notification error:', emailError);
    }

    return NextResponse.json({ success: true, changeRequest });
  } catch (error: any) {
    console.error('Error submitting change request:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(
  RATE_LIMITS.changeRequest,
  submitChangeRequest,
  'Too many requests. Please wait before submitting another.'
);
