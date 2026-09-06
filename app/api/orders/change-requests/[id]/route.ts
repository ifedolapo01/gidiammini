// app/api/orders/change-requests/[id]/route.ts - admin approve/reject for a
// customer's reschedule or delivery-method-change request. Approving delegates
// to the same commerce functions the admin's manual order controls use, so
// the outcome is identical either way.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { sendCustomNotification } from '@/lib/notifications';
import type { DeliveryOutcome } from '@/lib/notifications/delivery';
import {
  applyOrderStatusTransition, type StatusChangeActor,
} from '@/lib/commerce/order-status-transition';
import { applyOrderShippingTransition } from '@/lib/commerce/order-shipping-transition';
import { resolveOrderShippingZone } from '@/lib/commerce/order-shipping-zone';
import type { DeliveryMethodChangeDetails, RescheduleDetails } from '@/types/orderChangeRequest';

// The admin who approved it, and the fact that the customer asked. Without
// both, a cancellation approved here is indistinguishable on the timeline from
// one an admin decided on alone.
async function applyApprovedChange(
  supabase: any,
  order: any,
  changeRequest: any,
  actor: StatusChangeActor
) {
  const reason = `Approved the customer's ${changeRequest.request_type} request.`;

  if (changeRequest.request_type === 'reschedule') {
    const { preferredDate } = changeRequest.details as RescheduleDetails;
    const result = await applyOrderStatusTransition(supabase, order.id, 'rescheduled', {
      notificationMessage: `Your delivery reschedule request has been approved — new date: ${preferredDate}.`,
      actor,
      reason,
    });
    return { success: result.success, error: result.error, status: result.status, delivery: result.delivery };
  }

  if (changeRequest.request_type === 'cancel') {
    const result = await applyOrderStatusTransition(supabase, order.id, 'cancelled', {
      notificationMessage: 'Your cancellation request has been approved — your order has been cancelled.',
      actor,
      reason,
      // A customer-initiated cancellation always has the same ground, and
      // recording it here is what keeps the breakdown honest: without it every
      // approved request would land in the cancellation report as "no reason".
      reasonCode: 'customer_changed_mind',
    });
    return { success: result.success, error: result.error, status: result.status, delivery: result.delivery };
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
  return { success: result.success, error: result.error, status: result.status, delivery: result.delivery };
}

// Goes through withAdminAuth so an approval or rejection is attributable.
// Approving a change request runs the same stock and notification work as a
// manual admin edit, so it belongs in the trail for the same reasons.
export const PUT = withAdminAuth(async (request, { supabase, params, actor, audit }) => {
  try {
    const { id } = await params;
    const { decision, adminResponse } = await request.json();

    if (!['approved', 'rejected'].includes(decision)) {
      return NextResponse.json(
        { success: false, error: "decision must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

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

    /** Which channels the customer was actually reached on, for either branch —
     * so the admin toast can say "Email sent · SMS not configured" instead of
     * claiming the customer was notified regardless. */
    let delivery: DeliveryOutcome | undefined;

    if (decision === 'approved') {
      const applyResult = await applyApprovedChange(supabase, order, changeRequest, {
        id: actor.id,
        email: actor.email,
      });
      if (!applyResult.success) {
        return NextResponse.json({ success: false, error: applyResult.error }, { status: applyResult.status || 500 });
      }
      delivery = applyResult.delivery;
    } else {
      try {
        const requestLabel = changeRequest.request_type === 'reschedule'
          ? 'reschedule'
          : changeRequest.request_type === 'cancel'
          ? 'cancellation'
          : 'delivery method change';
        delivery = await sendCustomNotification({
          orderId: order.id ?? null,
          customerId: order.customer_id ?? null,
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

    audit({
      entityType: 'order_change_request',
      entityId: id,
      action: decision === 'approved' ? 'approve' : 'reject',
      before: { status: 'pending', request_type: changeRequest.request_type, details: changeRequest.details },
      after: { status: decision },
      // The admin's own words to the customer double as the reason.
      reason: typeof adminResponse === 'string' ? adminResponse : null,
    });

    return NextResponse.json({ success: true, changeRequest: updatedRequest, delivery });
  } catch (error: any) {
    console.error('Error resolving change request:', error);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
});
