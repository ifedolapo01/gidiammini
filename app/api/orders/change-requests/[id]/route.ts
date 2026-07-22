// app/api/orders/change-requests/[id]/route.ts - admin approve/reject for a
// customer's reschedule or delivery-method-change request. Approving delegates
// to the same commerce functions the admin's manual order controls use, so
// the outcome is identical either way.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifyAdminAuth } from '@/lib/auth';
import { sendCustomNotification } from '@/lib/notifications';
import { applyOrderStatusTransition } from '@/lib/commerce/order-status-transition';
import { applyOrderShippingTransition } from '@/lib/commerce/order-shipping-transition';
import { resolveOrderShippingZone } from '@/lib/commerce/order-shipping-zone';
import type { DeliveryMethodChangeDetails, RescheduleDetails } from '@/types/orderChangeRequest';

async function applyApprovedChange(supabase: any, order: any, changeRequest: any) {
  if (changeRequest.request_type === 'reschedule') {
    const { preferredDate } = changeRequest.details as RescheduleDetails;
    const result = await applyOrderStatusTransition(supabase, order.id, 'rescheduled', {
      notificationMessage: `Your delivery reschedule request has been approved — new date: ${preferredDate}.`,
    });
    return { success: result.success, error: result.error, status: result.status };
  }

  const { newDeliveryOption, deliveryAddress, city } = changeRequest.details as DeliveryMethodChangeDetails;
  const zone = await resolveOrderShippingZone(supabase, order);

  if (!zone) {
    return { success: false, error: 'No shipping zone is configured for this order\'s location.', status: 400 };
  }

  const result = await applyOrderShippingTransition(supabase, order.id, {
    shippingZoneId: zone.id,
    deliveryOption: newDeliveryOption,
    deliveryAddress,
    city,
  });
  return { success: result.success, error: result.error, status: result.status };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { decision, adminResponse } = await request.json();

    if (!['approved', 'rejected'].includes(decision)) {
      return NextResponse.json(
        { success: false, error: "decision must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: changeRequest, error: fetchError } = await supabase
      .from('order_change_requests')
      .select('*, orders (*)')
      .eq('id', id)
      .single();

    if (fetchError || !changeRequest) {
      return NextResponse.json({ success: false, error: 'Change request not found' }, { status: 404 });
    }

    if (changeRequest.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'This request has already been resolved' }, { status: 400 });
    }

    const order = changeRequest.orders;

    if (decision === 'approved') {
      const applyResult = await applyApprovedChange(supabase, order, changeRequest);
      if (!applyResult.success) {
        return NextResponse.json({ success: false, error: applyResult.error }, { status: applyResult.status || 500 });
      }
    } else {
      try {
        const requestLabel = changeRequest.request_type === 'reschedule' ? 'reschedule' : 'delivery method change';
        await sendCustomNotification({
          orderNumber: order.order_number,
          customerName: order.customer_name,
          customerEmail: order.customer_email,
          customerPhone: order.customer_phone,
          message: `Your ${requestLabel} request could not be approved.${adminResponse ? ` Reason: ${adminResponse}` : ''}`,
          viaEmail: true,
          viaSMS: true,
        });
      } catch (notificationError) {
        console.error('Change request rejection notification error:', notificationError);
      }
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from('order_change_requests')
      .update({
        status: decision,
        admin_response: adminResponse || null,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: `Database error: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, changeRequest: updatedRequest });
  } catch (error: any) {
    console.error('Error resolving change request:', error);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}
