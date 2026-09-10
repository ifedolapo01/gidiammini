// app/api/admin/subsubcategories/route.ts - admin CRUD for sub-subcategories.
//
// Mirrors app/api/admin/subcategories/route.ts one level down: subsubcategories
// belongs to a subcategory the same way a subcategory belongs to a category.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth, type AuditRecorder } from '@/lib/api/with-admin-auth';
import { readForAudit } from '@/lib/api/audit';
import { describeCategoryWriteError } from '@/lib/api/category-write-errors';

export const maxDuration = 30;

async function createSubSubcategory(supabase: SupabaseClient, request: NextRequest, audit: AuditRecorder) {
  const body = await request.json();

  if (!body.name || !body.slug || !body.subcategory_slug) {
    return NextResponse.json(
      { success: false, error: 'Name, slug and subcategory_slug are required' },
      { status: 400 }
    );
  }

  const subSubcategoryData = {
    name: body.name,
    slug: body.slug,
    subcategory_slug: body.subcategory_slug,
  };

  // subsubcategories doesn't exist in the generated types until `npm run
  // db:types` is rerun against a database that has this migration applied —
  // same loose-typing convention product-listing-query.ts already documents
  // for code written ahead of a push.
  const { data, error } = await (supabase as any)
    .from('subsubcategories')
    .insert([subSubcategoryData])
    .select()
    .single();

  if (error) {
    const { message, status } = describeCategoryWriteError(error, { noun: 'sub-subcategory', parentNoun: 'subcategory' });
    return NextResponse.json({ success: false, error: message }, { status });
  }

  audit({ entityType: 'subsubcategory', entityId: data.id, action: 'create', after: data });

  return NextResponse.json({ success: true, subsubcategory: data, message: 'Sub-subcategory created successfully' });
}

async function deleteSubSubcategory(supabase: SupabaseClient, request: NextRequest, audit: AuditRecorder) {
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { success: false, error: 'Sub-subcategory ID is required' },
      { status: 400 }
    );
  }

  const previous = await readForAudit(supabase, 'subsubcategories', body.id);

  const { error } = await (supabase as any)
    .from('subsubcategories')
    .delete()
    .eq('id', body.id);

  if (error) throw error;

  audit({ entityType: 'subsubcategory', entityId: body.id, action: 'delete', before: previous });

  return NextResponse.json({ success: true, message: 'Sub-subcategory deleted successfully' });
}

export const POST = withAdminAuth((request, { supabase, audit }) => createSubSubcategory(supabase, request, audit));
export const DELETE = withAdminAuth((request, { supabase, audit }) => deleteSubSubcategory(supabase, request, audit));
