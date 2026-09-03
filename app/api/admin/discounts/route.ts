import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth, type AuditRecorder } from '@/lib/api/with-admin-auth';
import { diffForAudit, isEmptyDiff, readForAudit, withoutTimestamps } from '@/lib/api/audit';

export const maxDuration = 30;

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

  if (!body.name || !body.type || !body.value || !body.scope) {
    return NextResponse.json(
      { success: false, error: 'Name, type, value and scope are required' },
      { status: 400 }
    );
  }

  const discountData = {
    name: body.name,
    type: body.type, // 'PERCENTAGE' or 'FIXED'
    value: Number(body.value),
    scope: body.scope, // 'SITEWIDE', 'CATEGORY', 'SUBCATEGORY', 'PRODUCT'
    target_id: body.target_id || null, // Optional target identifier
    is_active: body.is_active ?? true,
    start_date: body.start_date || null,
    end_date: body.end_date || null
  };

  const { data, error } = await supabase
    .from('discounts')
    .insert([discountData])
    .select()
    .single();

  if (error) throw error;

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

  const updateData = {
    name: body.name,
    type: body.type,
    value: Number(body.value),
    scope: body.scope,
    target_id: body.target_id,
    is_active: body.is_active,
    start_date: body.start_date,
    end_date: body.end_date
  };

  const previous = await readForAudit(supabase, 'discounts', body.id);

  const { data, error } = await supabase
    .from('discounts')
    .update(updateData)
    .eq('id', body.id)
    .select()
    .single();

  if (error) throw error;

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
