// app/api/orders/[id]/shipping/route.ts - admin override of an order's
// shipping method, delegating the actual mutation to
// lib/commerce/order-shipping-transition.ts so the change-request approval
// flow can trigger the exact same behavior.
//
// Goes through withAdminAuth so the override lands in the audit trail. A
// shipping change moves the delivery fee and therefore the order total, which
// makes "who changed this and why" a question someone will eventually ask.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { applyOrderShippingTransition } from '@/lib/commerce/order-shipping-transition';
import { diffForAudit } from '@/lib/api/audit';

export const PUT = withAdminAuth(async (request, { supabase, params, audit }) => {
  const { id: orderId } = await params;
  const body = await request.json();
  const { shipping_zone_id, delivery_option, reason } = body;

  if (!shipping_zone_id || !delivery_option) {
    return NextResponse.json(
      { success: false, error: 'shipping_zone_id and delivery_option are required' },
      { status: 400 }
    );
  }

  if (!['pickup', 'delivery'].includes(delivery_option)) {
    return NextResponse.json(
      { success: false, error: "delivery_option must be 'pickup' or 'delivery'" },
      { status: 400 }
    );
  }

  const result = await applyOrderShippingTransition(supabase, orderId, {
    shippingZoneId: shipping_zone_id,
    deliveryOption: delivery_option,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status || 500 });
  }

  const diff = diffForAudit(result.previous ?? null, result.order ?? null);
  audit({
    entityType: 'order',
    entityId: orderId,
    action: 'shipping_change',
    before: diff.before,
    after: diff.after,
    reason: typeof reason === 'string' ? reason : null,
  });

  return NextResponse.json({
    success: true,
    order: result.order,
    message: 'Shipping method updated',
    delivery: result.delivery,
  });
});
