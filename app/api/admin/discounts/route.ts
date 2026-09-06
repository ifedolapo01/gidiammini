import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth, type AuditRecorder } from '@/lib/api/with-admin-auth';
import { diffForAudit, isEmptyDiff, readForAudit, withoutTimestamps } from '@/lib/api/audit';

export const maxDuration = 30;

/**
 * The writable columns, from an untrusted body.
 *
 * One mapper for create and update, because the two had already drifted into
 * separate literals of the same shape — and a discount saved through one path
 * with a field the other forgets is a discount that behaves differently
 * depending on whether it was new.
 *
 * The nullable numerics distinguish blank from zero deliberately: null is "no
 * limit" and 0 is "nobody may use this", and collapsing them would silently
 * disable every code an owner left unlimited.
 */
function optionalCount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

function buildDiscountFields(body: any) {
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';

  return {
    name: body.name,
    type: body.type,
    // FREE_SHIPPING waives whatever the zone charges, so its own value is
    // meaningless and pinned to 0 by a CHECK. Forcing it here means the form
    // does not have to remember.
    value: body.type === 'FREE_SHIPPING' ? 0 : Number(body.value),
    scope: body.scope,
    target_id: body.target_id || null,
    is_active: body.is_active ?? true,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    // Empty string is not a code. Stored as null so `code IS NOT NULL` stays
    // the single test for "this discount is opt-in".
    code: code === '' ? null : code,
    max_redemptions: optionalCount(body.max_redemptions),
    per_customer_limit: optionalCount(body.per_customer_limit),
    min_order_value: Math.max(0, Math.trunc(Number(body.min_order_value) || 0)),
  };
}

/** 23505 on the code index: somebody is already using that code. */
const UNIQUE_VIOLATION = '23505';

function describeWriteError(error: { code?: string; message?: string }): string | null {
  if (error.code === UNIQUE_VIOLATION) {
    return 'That code is already in use by another discount. Pick a different one.';
  }
  return null;
}

async function listDiscounts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('discounts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return NextResponse.json({ success: true, discounts: data });
}

async function createDiscount(supabase: SupabaseClient, request: NextRequest, audit: AuditRecorder) {
  const body = await request.json();

  // `!body.value` was the old test, which rejected every FREE_SHIPPING
  // discount: its value is 0 by design and 0 is falsy.
  const needsValue = body.type !== 'FREE_SHIPPING';
  if (!body.name || !body.type || !body.scope || (needsValue && !body.value)) {
    return NextResponse.json(
      { success: false, error: 'Name, type, value and scope are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('discounts')
    .insert([buildDiscountFields(body)])
    .select()
    .single();

  if (error) {
    const message = describeWriteError(error);
    if (message) return NextResponse.json({ success: false, error: message }, { status: 409 });
    throw error;
  }

  audit({ entityType: 'discount', entityId: data.id, action: 'create', after: data });

  return NextResponse.json({ success: true, discount: data, message: 'Discount created successfully' });
}

async function updateDiscount(supabase: SupabaseClient, request: NextRequest, audit: AuditRecorder) {
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { success: false, error: 'Discount ID is required' },
      { status: 400 }
    );
  }

  const updateData = buildDiscountFields(body);

  const previous = await readForAudit(supabase, 'discounts', body.id);

  const { data, error } = await supabase
    .from('discounts')
    .update(updateData)
    .eq('id', body.id)
    .select()
    .single();

  if (error) {
    const message = describeWriteError(error);
    if (message) return NextResponse.json({ success: false, error: message }, { status: 409 });
    throw error;
  }

  const diff = withoutTimestamps(diffForAudit(previous, data));
  if (!isEmptyDiff(diff)) {
    audit({
      entityType: 'discount',
      entityId: body.id,
      action: 'update',
      before: diff.before,
      after: diff.after,
      reason: typeof body.reason === 'string' ? body.reason : null,
    });
  }

  return NextResponse.json({ success: true, discount: data, message: 'Discount updated successfully' });
}

async function deleteDiscount(supabase: SupabaseClient, request: NextRequest, audit: AuditRecorder) {
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { success: false, error: 'Discount ID is required' },
      { status: 400 }
    );
  }

  const previous = await readForAudit(supabase, 'discounts', body.id);

  const { error } = await supabase
    .from('discounts')
    .delete()
    .eq('id', body.id);

  if (error) throw error;

  audit({
    entityType: 'discount',
    entityId: body.id,
    action: 'delete',
    before: previous,
    reason: typeof body.reason === 'string' ? body.reason : null,
  });

  return NextResponse.json({ success: true, message: 'Discount deleted successfully' });
}

export const GET = withAdminAuth((_request, { supabase }) => listDiscounts(supabase));
export const POST = withAdminAuth((request, { supabase, audit }) => createDiscount(supabase, request, audit));
export const PUT = withAdminAuth((request, { supabase, audit }) => updateDiscount(supabase, request, audit));
export const DELETE = withAdminAuth((request, { supabase, audit }) => deleteDiscount(supabase, request, audit));
