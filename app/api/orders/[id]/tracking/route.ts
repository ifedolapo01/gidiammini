// app/api/orders/[id]/tracking/route.ts - correcting the courier details after
// the fact.
//
// The waybill is normally captured on the transition to 'shipped', which is
// when it is in somebody's hand. But a mistyped digit is discovered later, by
// definition — usually when the customer says the link does not work — and
// without this the only ways to fix it are to edit the database by hand or to
// re-ship an order that has already shipped, which would send a second
// shipping notification.
//
// Deliberately does not notify. This endpoint exists for corrections, and a
// second "your order has shipped" email for a typo is worse than the typo. An
// admin who genuinely needs to re-tell the customer has the notify form on the
// same panel.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { parseJsonBody } from '@/lib/api/parse-body';
import { orderShipmentSchema } from '@/lib/api/schemas/admin-orders';
import { resolveTrackingFields } from '@/lib/commerce/order-tracking';
import { diffForAudit, isEmptyDiff, readForAudit } from '@/lib/api/audit';

export const PUT = withAdminAuth(async (request, { supabase, params, audit }) => {
  const { id } = await params;

  const parsed = await parseJsonBody(request, orderShipmentSchema);
  if (!parsed.ok) return parsed.response;

  const previous = await readForAudit(supabase, 'orders', id, 'carrier, tracking_number, tracking_url');
  if (!previous) {
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
  }

  const tracking = resolveTrackingFields({
    carrier: parsed.data.carrier,
    trackingNumber: parsed.data.tracking_number,
    trackingUrl: parsed.data.tracking_url,
  });

  const { data, error } = await supabase
    .from('orders')
    .update({
      carrier: tracking.carrier,
      tracking_number: tracking.trackingNumber,
      tracking_url: tracking.trackingUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, carrier, tracking_number, tracking_url')
    .maybeSingle();

  if (error) {
    console.error('Error updating tracking:', error);
    return NextResponse.json(
      { success: false, error: `Database error: ${error.message}` },
      { status: 500 }
    );
  }

  const diff = diffForAudit(previous, data as unknown as Record<string, unknown>);
  if (!isEmptyDiff(diff)) {
    audit({
      entityType: 'order',
      entityId: id,
      action: 'shipping_change',
      before: diff.before,
      after: diff.after,
    });
  }

  return NextResponse.json({ success: true, tracking: data });
});
