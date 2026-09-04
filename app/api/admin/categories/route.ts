// app/api/admin/categories/route.ts - admin CRUD for categories.
//
// Goes through withAdminAuth, which supplies the service-role client and puts
// every change in the audit trail. It previously checked auth itself and built
// its own Supabase client inline, three times over, so a category deletion
// left no trace of who did it.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { parseCategoryEdit } from '@/lib/commerce/category-edit';

export const maxDuration = 30;

/** Fallbacks so a category always has a gradient, even if none was chosen. */
const DEFAULT_COLORS = [
  'from-amber-300/80 to-orange-400/90',
  'from-sky-300/80 to-indigo-400/90',
  'from-pink-300/80 to-purple-400/90',
  'from-emerald-300/80 to-teal-400/90',
  'from-fuchsia-300/80 to-rose-400/90',
  'from-violet-300/80 to-purple-500/90',
];

export const GET = withAdminAuth(async (_request, { supabase }) => {
  const { data, error } = await supabase.from('categories').select('*, subcategories(*)');

  if (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, categories: data });
});

export const POST = withAdminAuth(async (request, { supabase, audit }) => {
  const body = await request.json();

  if (!body.name || !body.slug) {
    return NextResponse.json(
      { success: false, error: 'Name and slug are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('categories')
    .insert([{
      name: body.name,
      slug: body.slug,
      color: body.color || DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create category', details: error.message },
      { status: 500 }
    );
  }

  audit({ entityType: 'category', entityId: data.id, action: 'create', after: data });

  return NextResponse.json({ success: true, category: data, message: 'Category created successfully' });
});

/**
 * Editing a category.
 *
 * A PATCH rather than a PUT because only two fields are editable: the size
 * guidance, and the storefront name the navigation and product cards render.
 * `name` and `slug` are referenced by products and discounts by value, so
 * changing those is a migration, not a form. Which fields are valid, and what
 * an empty one means, is parseCategoryEdit's job.
 */
export const PATCH = withAdminAuth(async (request, { supabase, audit }) => {
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { success: false, error: 'Category ID is required' },
      { status: 400 }
    );
  }

  const edit = parseCategoryEdit(body);
  if (!edit.ok) {
    return NextResponse.json({ success: false, error: edit.error }, { status: 400 });
  }

  const { data: previous } = await supabase
    .from('categories')
    .select('id, name, display_name, size_guidance')
    .eq('id', body.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('categories')
    .update(edit.update)
    .eq('id', body.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating category:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update category', details: error.message },
      { status: 500 }
    );
  }

  audit({ entityType: 'category', entityId: body.id, action: 'update', before: previous, after: data });

  return NextResponse.json({ success: true, category: data, message: 'Category saved' });
});

export const DELETE = withAdminAuth(async (request, { supabase, audit }) => {
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { success: false, error: 'Category ID is required' },
      { status: 400 }
    );
  }

  // Read it first: a hard delete leaves nothing to describe afterwards, and
  // "which category was removed" is the whole question.
  const { data: previous } = await supabase
    .from('categories')
    .select('*')
    .eq('id', body.id)
    .maybeSingle();

  const { error } = await supabase.from('categories').delete().eq('id', body.id);

  if (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete category', details: error.message },
      { status: 500 }
    );
  }

  audit({
    entityType: 'category',
    entityId: body.id,
    action: 'delete',
    before: previous,
    reason: typeof body.reason === 'string' ? body.reason : null,
  });

  return NextResponse.json({ success: true, message: 'Category deleted successfully' });
});
