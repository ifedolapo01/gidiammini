// app/api/orders/[id]/returns/route.ts - the returns on this order.
//
// GET only — creation is the public, rate-limited /api/orders/returns
// (order number + email/phone, no admin session). Its own endpoint rather
// than a relation embedded on GET /api/orders/[id] for the same reason
// refunds are: most orders never have one, and the Returns tab loads on
// demand.
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth } from '@/lib/api/with-admin-auth';

const RETURN_COLUMNS = `
  id, rma_number, order_id, status, reason, admin_response, refund_id,
  requested_at, approved_at, received_at, inspected_at, restocked_at, rejected_at, refunded_at,
  return_items ( id, order_item_id, quantity, restocked )
`;

export const GET = withAdminAuth(async (_request, { supabase, params }) => {
  const { id } = await params;

  // Typed loosely until `npm run db:types` reruns against a database that has
  // this migration — returns is not in the generated types yet.
  const { data, error } = await (supabase as unknown as SupabaseClient)
    .from('returns')
    .select(RETURN_COLUMNS)
    .eq('order_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading returns:', error);
    return NextResponse.json({ success: false, error: 'Failed to load returns', returns: [] }, { status: 500 });
  }

  return NextResponse.json({ success: true, returns: data ?? [] });
});
