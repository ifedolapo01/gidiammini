// app/api/admin/homepage-slides/[id]/route.ts - editing and removing one slide.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { parseSlideUpdate } from '@/lib/commerce/homepage-slide-edit';

const notFound = () =>
  NextResponse.json({ success: false, error: 'That slide no longer exists.' }, { status: 404 });

export const PATCH = withAdminAuth(async (request, { supabase, params, audit }) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = parseSlideUpdate(body);
  if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });

  const { data: previous } = await supabase.from('homepage_slides').select('*').eq('id', id).maybeSingle();
  if (!previous) return notFound();

  const { data, error } = await supabase
    .from('homepage_slides')
    .update(parsed.update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating homepage slide:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update homepage slide', details: error.message },
      { status: 500 }
    );
  }

  audit({ entityType: 'homepage_slide', entityId: id, action: 'update', before: previous, after: data });

  return NextResponse.json({ success: true, slide: data, message: 'Slide saved' });
});

export const DELETE = withAdminAuth(async (_request, { supabase, params, audit }) => {
  const { id } = await params;

  const { data: previous } = await supabase.from('homepage_slides').select('*').eq('id', id).maybeSingle();
  if (!previous) return notFound();

  const { error } = await supabase.from('homepage_slides').delete().eq('id', id);

  if (error) {
    console.error('Error deleting homepage slide:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete homepage slide', details: error.message },
      { status: 500 }
    );
  }

  audit({ entityType: 'homepage_slide', entityId: id, action: 'delete', before: previous });

  return NextResponse.json({ success: true, message: 'Slide deleted' });
});
