// app/api/orders/change-requests/[id]/route.ts - admin approve/reject for a
// customer's order-change request. Approving delegates to the same commerce
// functions the admin's manual order controls use, so the outcome is
// identical either way.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { sendCustomNotification } from '@/lib/notifications';
import type { DeliveryOutcome } from '@/lib/notifications/delivery';
import {
  applyOrderStatusTransition, type StatusChangeActor,
} from '@/lib/commerce/order-status-transition';
import { applyOrderShippingTransition } from '@/lib/commerce/order-shipping-transition';
import { resolveOrderShippingZone } from '@/lib/commerce/order-shipping-zone';
import { editOrderItems } from '@/lib/commerce/order-edit';
import { recordOrderRefund } from '@/lib/commerce/order-refunds';
import { findVariant, ADMIN_VARIANTS_SELECT } from '@/lib/commerce/product-variants';
import { getVariantPrice } from '@/lib/commerce/pricing';
import type { OrderLine } from '@/lib/commerce/order-edit-diff';
import type {
  DeliveryMethodChangeDetails,
  RescheduleDetails,
  AddressCorrectionDetails,
  ItemSwapDetails,
  AddItemDetails,
  ReturnRequestDetails,
  HoldUntilDetails,
} from '@/types/orderChangeRequest';

interface ApprovalResult {
  success: boolean;
  error?: string;
  status?: number;
  delivery?: DeliveryOutcome;
}

/** email-only outcome, for the two branches (item edits, a refund) that
 *  notify without going through the DeliveryOutcome-producing helpers the
 *  others already use — so the admin toast still says what happened. */
function emailOnlyOutcome(notified: boolean): DeliveryOutcome {
  return notified
    ? { delivered: ['email'], failed: [{ channel: 'sms', reason: 'not_requested' }] }
    : { delivered: [], failed: [{ channel: 'email', reason: 'provider_error' }, { channel: 'sms', reason: 'not_requested' }] };
}

/** item_swap and add_item both need the live variant a free-text size/colour
 *  resolves to — like reschedule's preferredDate, that text is never
 *  validated until it's acted on. Returns the priced OrderLine, or an error
 *  a human can act on (message the customer with an alternative). */
async function resolveRequestedVariant(
  supabase: any,
  productId: string,
  size: string | undefined,
  color: string | undefined,
  quantity: number
): Promise<{ ok: true; line: OrderLine } | { ok: false; error: string }> {
  const { data: product, error } = await supabase
    .from('products')
    .select(`id, name, price, pricing_config, ${ADMIN_VARIANTS_SELECT}`)
    .eq('id', productId)
    .maybeSingle();

  if (error || !product) {
    return { ok: false, error: 'That product could not be found in the catalogue.' };
  }

  const variant = findVariant(product, size || null, color || null);
  if (!variant) {
    return {
      ok: false,
      error: `${product.name} has no ${[size, color].filter(Boolean).join('/') || 'matching'} variant — message the customer with what is actually available.`,
    };
  }
  if (variant.stock < quantity) {
    return {
      ok: false,
      error: `Only ${variant.stock} of ${product.name} (${[size, color].filter(Boolean).join(', ')}) left — not enough for this request.`,
    };
  }

  return {
    ok: true,
    line: {
      product_id: product.id,
      product_name: product.name,
      price: getVariantPrice(product, size || null, color || null),
      quantity,
      size: variant.size,
      color: variant.color,
    },
  };
}

function toOrderLines(orderItems: any[]): OrderLine[] {
  return orderItems.map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    price: item.price,
    quantity: item.quantity,
    size: item.size,
    color: item.color,
  }));
}

async function applyItemSwap(supabase: any, order: any, details: ItemSwapDetails): Promise<ApprovalResult> {
  const resolved = await resolveRequestedVariant(supabase, details.productId, details.newSize, details.newColor, 1);
  if (!resolved.ok) return { success: false, error: resolved.error, status: 400 };

  const lines = toOrderLines(order.order_items ?? []);
  const index = lines.findIndex((line) => line.product_id === details.productId);
  if (index === -1) return { success: false, error: 'That item is no longer on this order.', status: 400 };

  // Keeps the line's own quantity — this is a swap, not a re-order.
  lines[index] = { ...resolved.line, quantity: lines[index].quantity };

  const result = await editOrderItems(supabase, {
    orderId: order.id,
    items: lines,
    note: 'Approved the customer\'s item swap request.',
  });
  if (!result.ok) return { success: false, error: result.error, status: result.status };
  return { success: true, delivery: emailOnlyOutcome(result.notified) };
}

async function applyAddItem(supabase: any, order: any, details: AddItemDetails): Promise<ApprovalResult> {
  const resolved = await resolveRequestedVariant(supabase, details.productId, details.size, details.color, details.quantity);
  if (!resolved.ok) return { success: false, error: resolved.error, status: 400 };

  const lines = [...toOrderLines(order.order_items ?? []), resolved.line];

  const result = await editOrderItems(supabase, {
    orderId: order.id,
    items: lines,
    note: 'Approved the customer\'s add-item request.',
  });
  if (!result.ok) return { success: false, error: result.error, status: result.status };
  return { success: true, delivery: emailOnlyOutcome(result.notified) };
}

async function applyReturnRequest(
  supabase: any,
  order: any,
  details: ReturnRequestDetails,
  refundAmount: number | undefined,
  actor: StatusChangeActor
): Promise<ApprovalResult> {
  if (!refundAmount || refundAmount <= 0) {
    return { success: false, error: 'Enter the refund amount before approving.', status: 400 };
  }

  const result = await recordOrderRefund(
    supabase,
    {
      orderId: order.id,
      amount: refundAmount,
      method: 'transfer',
      reasonCode: 'customer_return',
      note: details.reason,
      settled: false,
    },
    actor
  );
  if (!result.ok) return { success: false, error: result.error, status: result.status };
  return { success: true, delivery: emailOnlyOutcome(result.notified) };
}

async function applyHoldUntil(supabase: any, order: any, details: HoldUntilDetails): Promise<ApprovalResult> {
  const requested = new Date(details.holdUntilDate);
  if (Number.isNaN(requested.getTime())) {
    return { success: false, error: 'That is not a valid date.', status: 400 };
  }

  // Only ever extends the hold — approving this can't shorten a reservation
  // window another part of the system already relies on.
  const current = order.reserved_until ? new Date(order.reserved_until) : null;
  if (!current || requested.getTime() > current.getTime()) {
    const { error } = await supabase
      .from('orders')
      .update({ reserved_until: requested.toISOString() })
      .eq('id', order.id);
    if (error) return { success: false, error: 'Could not extend the hold on this order.', status: 500 };
  }

  let delivery: DeliveryOutcome | undefined;
  try {
    delivery = await sendCustomNotification({
      orderId: order.id ?? null,
      customerId: order.customer_id ?? null,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      message: `We'll hold your order and won't ship it before ${details.holdUntilDate}.`,
      viaEmail: true,
      viaSMS: true,
    });
  } catch (notificationError) {
    console.error('Hold-until notification error:', notificationError);
  }

  return { success: true, delivery };
}

// The admin who approved it, and the fact that the customer asked. Without
// both, a cancellation approved here is indistinguishable on the timeline from
// one an admin decided on alone.
async function applyApprovedChange(
  supabase: any,
  order: any,
  changeRequest: any,
  actor: StatusChangeActor,
  refundAmount: number | undefined
): Promise<ApprovalResult> {
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

  if (changeRequest.request_type === 'delivery_method_change') {
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

  if (changeRequest.request_type === 'address_correction') {
    const { newAddress, city } = changeRequest.details as AddressCorrectionDetails;
    // Same zone, same delivery option — only the address moves.
    const result = await applyOrderShippingTransition(supabase, order.id, {
      shippingZoneId: order.shipping_zone_id,
      deliveryOption: order.delivery_option,
      deliveryAddress: newAddress,
      city: city || order.city,
    });
    return { success: result.success, error: result.error, status: result.status, delivery: result.delivery };
  }

  if (changeRequest.request_type === 'item_swap') {
    return applyItemSwap(supabase, order, changeRequest.details as ItemSwapDetails);
  }

  if (changeRequest.request_type === 'add_item') {
    return applyAddItem(supabase, order, changeRequest.details as AddItemDetails);
  }

  if (changeRequest.request_type === 'return_request') {
    return applyReturnRequest(supabase, order, changeRequest.details as ReturnRequestDetails, refundAmount, actor);
  }

  return applyHoldUntil(supabase, order, changeRequest.details as HoldUntilDetails);
}

// Goes through withAdminAuth so an approval or rejection is attributable.
// Approving a change request runs the same stock and notification work as a
// manual admin edit, so it belongs in the trail for the same reasons.
export const PUT = withAdminAuth(async (request, { supabase, params, actor, audit }) => {
  try {
    const { id } = await params;
    const { decision, adminResponse, refundAmount } = await request.json();

    if (!['approved', 'rejected'].includes(decision)) {
      return NextResponse.json(
        { success: false, error: "decision must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    const { data: changeRequest, error: fetchError } = await supabase
      .from('order_change_requests')
      .select('*, orders (*, order_items (*))')
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
      const applyResult = await applyApprovedChange(
        supabase,
        order,
        changeRequest,
        { id: actor.id, email: actor.email },
        typeof refundAmount === 'number' ? refundAmount : Number(refundAmount) || undefined
      );
      if (!applyResult.success) {
        return NextResponse.json({ success: false, error: applyResult.error }, { status: applyResult.status || 500 });
      }
      delivery = applyResult.delivery;
    } else {
      try {
        const requestLabel = changeRequest.request_type.replace(/_/g, ' ');
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
