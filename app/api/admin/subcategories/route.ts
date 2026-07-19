import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth } from '@/lib/api/with-admin-auth';

export const maxDuration = 30;

async function createSubcategory(supabase: SupabaseClient, request: NextRequest) {
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

  return NextResponse.json({ success: true, subcategory: data, message: 'Subcategory created successfully' });
}

async function deleteSubcategory(supabase: SupabaseClient, request: NextRequest) {
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { success: false, error: 'Subcategory ID is required' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('subcategories')
    .delete()
    .eq('id', body.id);

  if (error) throw error;

  return NextResponse.json({ success: true, message: 'Subcategory deleted successfully' });
}

export const POST = withAdminAuth((request, { supabase }) => createSubcategory(supabase, request));
export const DELETE = withAdminAuth((request, { supabase }) => deleteSubcategory(supabase, request));
