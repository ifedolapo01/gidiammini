// app/api/orders/[id]/returns/[returnId]/route.ts - one step in a return's
// lifecycle. Nested under the order for the same reason the refund routes
// are: a return id can never be actioned against the wrong order by a caller
// that guessed one, and the permission table governs it by the order pattern.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { parseJsonBody } from '@/lib/api/parse-body';
import { returnActionSchema } from '@/lib/api/schemas/admin-orders';
import {
  approveReturn,
  rejectReturn,
  markReturnReceived,
  markReturnInspected,
  restockReturn,
  type ReturnLifecycleResult,
} from '@/lib/commerce/return-lifecycle';

export const PATCH = withAdminAuth(async (request, { supabase, params, actor, audit }) => {
  const { id, returnId } = await params;

  const parsed = await parseJsonBody(request, returnActionSchema);
  if (!parsed.ok) return parsed.response;

  const { action, adminResponse, refundAmount } = parsed.data;
  const changeActor = { id: actor.id, email: actor.email };

  let result: ReturnLifecycleResult;

  switch (action) {
    case 'approve':
      result = await approveReturn(supabase, returnId, changeActor, adminResponse || undefined);
      break;
    case 'reject':
      result = await rejectReturn(supabase, returnId, changeActor, adminResponse || undefined);
      break;
    case 'receive':
      result = await markReturnReceived(supabase, returnId, changeActor);
      break;
    case 'inspect':
      result = await markReturnInspected(supabase, returnId, changeActor);
      break;
    case 'restock':
      if (!refundAmount || refundAmount <= 0) {
        return NextResponse.json(
          { success: false, error: 'Enter the refund amount before restocking.' },
          { status: 400 }
        );
      }
      result = await restockReturn(supabase, returnId, changeActor, refundAmount);
      break;
  }

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  // A return actioned against a different order than the URL claims is either
  // a bug or somebody probing. Either way it is worth seeing in the feed.
  if (result.return.order_id !== id) {
    console.warn(`Return ${returnId} belongs to order ${result.return.order_id}, not ${id}.`);
  }

  audit({
    entityType: 'return',
    entityId: returnId,
    action: action === 'approve' || action === 'reject' ? action : 'update',
    after: { status: result.return.status },
    reason: adminResponse || null,
  });

  return NextResponse.json({ success: true, return: result.return });
});
