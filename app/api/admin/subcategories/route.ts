import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth, type AuditRecorder } from '@/lib/api/with-admin-auth';
import { readForAudit } from '@/lib/api/audit';

export const maxDuration = 30;

async function createSubcategory(supabase: SupabaseClient, request: NextRequest, audit: AuditRecorder) {
  const body = await request.json();

  if (!body.name || !body.slug || !body.category_slug) {
    return NextResponse.json(
      { success: false, error: 'Name, slug and category_slug are required' },
      { status: 400 }
    );
  }

  const subcategoryData = {
    name: body.name,
    slug: body.slug,
    category_slug: body.category_slug,
  };

  const { data, error } = await supabase
    .from('subcategories')
    .insert([subcategoryData])
    .select()
    .single();

  if (error) throw error;

  audit({ entityType: 'subcategory', entityId: data.id, action: 'create', after: data });

  return NextResponse.json({ success: true, subcategory: data, message: 'Subcategory created successfully' });
}

async function deleteSubcategory(supabase: SupabaseClient, request: NextRequest, audit: AuditRecorder) {
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { success: false, error: 'Subcategory ID is required' },
      { status: 400 }
    );
  }

  const previous = await readForAudit(supabase, 'subcategories', body.id);

  const { error } = await supabase
    .from('subcategories')
    .delete()
    .eq('id', body.id);

  if (error) throw error;

  audit({ entityType: 'subcategory', entityId: body.id, action: 'delete', before: previous });

  return NextResponse.json({ success: true, message: 'Subcategory deleted successfully' });
}

export const POST = withAdminAuth((request, { supabase, audit }) => createSubcategory(supabase, request, audit));
export const DELETE = withAdminAuth((request, { supabase, audit }) => deleteSubcategory(supabase, request, audit));
