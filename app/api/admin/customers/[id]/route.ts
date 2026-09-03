// app/api/admin/customers/[id]/route.ts - one buyer, their derived stats, and
// their order history. Also the only place is_blocked / notes can be changed.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { parseJsonBody } from '@/lib/api/parse-body';
import { diffForAudit, isEmptyDiff, readForAudit, type AuditAction } from '@/lib/api/audit';
import type { AuditRecorder } from '@/lib/api/with-admin-auth';
import { customerUpdateSchema } from '@/lib/api/schemas/admin-customers';

async function getCustomer(supabase: SupabaseClient<Database>, id: string) {
  const { data: stats, error: statsError } = await supabase
    .from('customer_stats')
    .select('*')
    .eq('customer_id', id)
    .maybeSingle();

  if (statsError) {
    console.error('Error loading customer:', statsError);
    return NextResponse.json({ success: false, error: 'Failed to load customer' }, { status: 500 });
  }

  if (!stats) {
    return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('notes, blocked_reason, phone_raw, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  // The snapshot columns are selected deliberately: they show what this buyer
  // typed on each order, which is what shipped, rather than their current
  // profile values.
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, order_number, status, total_amount, created_at, customer_name, customer_email, customer_phone, delivery_option')
    .eq('customer_id', id)
    .order('created_at', { ascending: false });

  if (ordersError) {
    console.error('Error loading customer orders:', ordersError);
  }

  return NextResponse.json({
    success: true,
    customer: { ...stats, ...(customer ?? {}) },
    orders: orders ?? [],
  });
}

async function updateCustomer(
  supabase: SupabaseClient<Database>,
  request: NextRequest,
  id: string,
  audit: AuditRecorder
) {
  const parsed = await parseJsonBody(request, customerUpdateSchema);
  if (!parsed.ok) return parsed.response;

  const previous = await readForAudit(supabase, 'customers', id, 'is_blocked, blocked_reason, notes');

  // Only these three columns are writable. Identity fields (email, phone) are
  // maintained from checkout, so editing them here would silently detach this
  // record from the orders that resolve to it.
  const { data, error } = await supabase
    .from('customers')
    .update({
      is_blocked: parsed.data.is_blocked,
      blocked_reason: parsed.data.is_blocked ? parsed.data.blocked_reason || null : null,
      notes: parsed.data.notes || null,
    })
    .eq('id', id)
    .select('id, is_blocked, blocked_reason, notes')
    .maybeSingle();

  if (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ success: false, error: `Database error: ${error.message}` }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
  }

  const diff = diffForAudit(previous, data as Record<string, unknown>);
  if (!isEmptyDiff(diff)) {
    // Blocking someone is a different act from editing a note, and the feed
    // should say which — a blocked buyer is refused at checkout.
    const blockChanged = previous?.is_blocked !== data.is_blocked;
    const action: AuditAction = blockChanged
      ? (data.is_blocked ? 'block' : 'unblock')
      : 'update';

    audit({
      entityType: 'customer',
      entityId: id,
      action,
      before: diff.before,
      after: diff.after,
      reason: parsed.data.blocked_reason || null,
    });
  }

  return NextResponse.json({ success: true, customer: data });
}

export const GET = withAdminAuth(async (_request, { supabase, params }) => {
  const { id } = await params;
  return getCustomer(supabase, id);
});

export const PUT = withAdminAuth(async (request, { supabase, params, audit }) => {
  const { id } = await params;
  return updateCustomer(supabase, request, id, audit);
});
