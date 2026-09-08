// app/api/admin/homepage-slides/route.ts - admin CRUD for the home page hero.
//
// Mirrors /api/admin/categories: withAdminAuth for the service-role client and
// the audit trail, this file only validates and dispatches. The storefront
// reads the same table through the anon key (lib/commerce/home-query.ts),
// filtered to active, in-window rows — this route returns everything, active
// or not, past or future, so the editor can show what's scheduled.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { parseSlideCreate } from '@/lib/commerce/homepage-slide-edit';

export const GET = withAdminAuth(async (_request, { supabase }) => {
  const { data, error } = await supabase
    .from('homepage_slides')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching homepage slides:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch homepage slides' }, { status: 500 });
  }

  return NextResponse.json({ success: true, slides: data });
});

export const POST = withAdminAuth(async (request, { supabase, audit }) => {
  const body = await request.json().catch(() => null);
  const parsed = parseSlideCreate(body);
  if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });

  // New slides go to the end of the order by default, not position 0 — an
  // admin adding a fourth slide almost never means "show this first".
  if (parsed.update.sort_order === undefined) {
    const { data: last } = await supabase
      .from('homepage_slides')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    parsed.update.sort_order = (last?.sort_order ?? -1) + 1;
  }

  const { data, error } = await supabase
    .from('homepage_slides')
    .insert([parsed.update])
    .select()
    .single();

  if (error) {
    console.error('Error creating homepage slide:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create homepage slide', details: error.message },
      { status: 500 }
    );
  }

  audit({ entityType: 'homepage_slide', entityId: data.id, action: 'create', after: data });

  return NextResponse.json({ success: true, slide: data, message: 'Slide created' });
});
