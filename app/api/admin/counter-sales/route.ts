// app/api/admin/counter-sales/route.ts - ring up a walk-in sale.
//
// Everything a checkout endpoint does — validate, price against the live
// catalogue, claim stock, write the order — except paid and handed over in
// the same moment rather than awaiting delivery or payment verification. See
// lib/commerce/create-counter-sale.ts for what that actually changes.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { parseJsonBody } from '@/lib/api/parse-body';
import { counterSaleSchema } from '@/lib/api/schemas/counter-sale';
import { createCounterSale } from '@/lib/commerce/create-counter-sale';

export const POST = withAdminAuth(async (request, { supabase, actor, audit }) => {
  const parsed = await parseJsonBody(request, counterSaleSchema);
  if (!parsed.ok) return parsed.response;

  const result = await createCounterSale(supabase, parsed.data, { id: actor.id, email: actor.email });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  audit({
    entityType: 'order',
    entityId: result.order.id,
    action: 'create',
    after: { order_number: result.order.order_number, sales_channel: 'counter' },
  });

  return NextResponse.json({
    success: true,
    message: result.replayed ? 'Sale already recorded' : 'Sale recorded',
    order: result.order,
    replayed: result.replayed === true,
  }, { status: result.replayed ? 200 : 201 });
});
