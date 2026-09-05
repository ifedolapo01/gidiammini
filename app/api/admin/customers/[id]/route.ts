// app/api/admin/customers/[id]/route.ts - one buyer, their derived stats, their
// order history, the addresses they have used and what they are still saving.
// Also the only place is_blocked / notes / tags can be changed.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { parseJsonBody } from '@/lib/api/parse-body';
import { diffForAudit, isEmptyDiff, readForAudit, type AuditAction } from '@/lib/api/audit';
import type { AuditRecorder } from '@/lib/api/with-admin-auth';
import { customerUpdateSchema } from '@/lib/api/schemas/admin-customers';

/**
 * Enough saved products to be a signal, not a catalogue. What the shop does
 * with this is "she has been eyeing these three since March" — a longer list
 * is the wishlist report, which already exists at /api/admin/wishlist.
 */
const WISHLIST_LIMIT = 12;

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
    .select('notes, blocked_reason, phone_raw, tags, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  // Four reads for one screen, in parallel. Each is small and indexed, and the
  // alternative — one view joining all of them — would have to fan out the
  // order rows against the address rows and be de-duplicated in JavaScript.
  const [orders, addresses, wishlist] = await Promise.all([
    // The snapshot columns are selected deliberately: they show what this buyer
    // typed on each order, which is what shipped, rather than their current
    // profile values.
    supabase
      .from('orders')
      .select(
        'id, order_number, status, total_amount, amount_paid, amount_refunded, created_at,' +
        ' customer_name, customer_email, customer_phone, delivery_option'
      )
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),

    supabase
      .from('customer_addresses')
      .select('delivery_address, city, selected_state, selected_lga, times_used, last_used_at')
      .eq('customer_id', id)
      .order('last_used_at', { ascending: false }),

    supabase
      .from('customer_wishlist')
      .select('product_id, created_at, products ( name, price, stock, main_image )')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(WISHLIST_LIMIT),
  ]);

  // Any of the three can fail without the page being useless, so each is
  // logged and reported empty rather than taking the whole response down.
  for (const [label, result] of [
    ['orders', orders], ['addresses', addresses], ['wishlist', wishlist],
  ] as const) {
    if (result.error) console.error(`Error loading customer ${label}:`, result.error.message);
  }

  return NextResponse.json({
    success: true,
    customer: { ...stats, ...(customer ?? {}) },
    orders: orders.data ?? [],
    addresses: addresses.data ?? [],
    wishlist: wishlist.data ?? [],
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

  const previous = await readForAudit(supabase, 'customers', id, 'is_blocked, blocked_reason, notes, tags');

  // Only these four columns are writable. Identity fields (email, phone) are
  // maintained from checkout, so editing them here would silently detach this
  // record from the orders that resolve to it.
  const { data, error } = await supabase
    .from('customers')
    .update({
      is_blocked: parsed.data.is_blocked,
      blocked_reason: parsed.data.is_blocked ? parsed.data.blocked_reason || null : null,
      notes: parsed.data.notes || null,
      // Undefined leaves the tags alone; an empty array clears them. The
      // trigger normalises and deduplicates whatever arrives.
      ...(parsed.data.tags ? { tags: parsed.data.tags } : {}),
    })
    .eq('id', id)
    .select('id, is_blocked, blocked_reason, notes, tags')
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
