import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth } from '@/lib/api/with-admin-auth';

export const maxDuration = 30;

async function listShippingZones(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('shipping_zones')
    .select('*, shipping_zone_exceptions(*)')
    .order('sort_order', { ascending: true });

  if (error) throw error;

  return NextResponse.json({ success: true, zones: data });
}

function buildZoneData(body: any) {
  return {
    name: body.name,
    state: body.state,
    lga: body.lga || null,
    places: body.lga ? (body.places || null) : null,
    delivery_fee: Number(body.delivery_fee) || 0,
    pickup_available: !!body.pickup_available,
    pickup_address: body.pickup_available ? (body.pickup_address || null) : null,
    contact_phone: body.contact_phone || null,
    delivery_label: body.delivery_label || 'Delivery',
    is_door_delivery: body.is_door_delivery ?? true,
    delivery_eta_min: Number(body.delivery_eta_min) || 1,
    delivery_eta_max: Number(body.delivery_eta_max) || Number(body.delivery_eta_min) || 1,
    delivery_eta_unit: body.delivery_eta_unit || 'days',
    is_primary: !!body.is_primary,
    is_active: body.is_active ?? true,
    sort_order: Number(body.sort_order) || 0,
  };
}

/** Only one zone can be the "main location" at a time. */
async function clearOtherPrimaryZones(supabase: SupabaseClient, exceptId?: string) {
  let query = supabase.from('shipping_zones').update({ is_primary: false });
  query = exceptId ? query.neq('id', exceptId) : query.neq('id', '00000000-0000-0000-0000-000000000000');
  const { error } = await query;
  if (error) throw error;
}

function buildExceptionData(exception: any, parentZoneId: string) {
  return {
    parent_zone_id: parentZoneId,
    lga: exception.lga || null,
    places: exception.places || null,
    delivery_fee: exception.delivery_fee ?? null,
    delivery_eta_min: exception.delivery_eta_min ?? null,
    delivery_eta_max: exception.delivery_eta_max ?? null,
    delivery_eta_unit: exception.delivery_eta_unit || null,
  };
}

/** Replace-all: exceptions carry no external references, so a full delete + re-insert
 * is the simplest correct way to reconcile add/edit/remove in one request. */
async function saveZoneExceptions(supabase: SupabaseClient, parentZoneId: string, exceptions: any[]) {
  const { error: deleteError } = await supabase
    .from('shipping_zone_exceptions')
    .delete()
    .eq('parent_zone_id', parentZoneId);
  if (deleteError) throw deleteError;

  const rows = (exceptions || []).filter(
    (e) => e.lga || e.places || e.delivery_fee != null || e.delivery_eta_min != null
  );
  if (rows.length === 0) return;

  const { error: insertError } = await supabase
    .from('shipping_zone_exceptions')
    .insert(rows.map((e) => buildExceptionData(e, parentZoneId)));
  if (insertError) throw insertError;
}

async function createShippingZone(supabase: SupabaseClient, request: NextRequest) {
  const body = await request.json();

  if (!body.name || !body.state) {
    return NextResponse.json(
      { success: false, error: 'Name and state are required' },
      { status: 400 }
    );
  }

  if (body.is_primary) {
    await clearOtherPrimaryZones(supabase);
  }

  const { data, error } = await supabase
    .from('shipping_zones')
    .insert([buildZoneData(body)])
    .select()
    .single();

  if (error) throw error;

  if (body.exceptions !== undefined) {
    await saveZoneExceptions(supabase, data.id, body.exceptions);
  }

  return NextResponse.json({ success: true, zone: data, message: 'Shipping zone created successfully' });
}

async function updateShippingZone(supabase: SupabaseClient, request: NextRequest) {
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { success: false, error: 'Shipping zone ID is required' },
      { status: 400 }
    );
  }

  if (body.is_primary) {
    await clearOtherPrimaryZones(supabase, body.id);
  }

  const { data, error } = await supabase
    .from('shipping_zones')
    .update({ ...buildZoneData(body), updated_at: new Date().toISOString() })
    .eq('id', body.id)
    .select()
    .single();

  if (error) throw error;

  if (body.exceptions !== undefined) {
    await saveZoneExceptions(supabase, body.id, body.exceptions);
  }

  return NextResponse.json({ success: true, zone: data, message: 'Shipping zone updated successfully' });
}

async function deleteShippingZone(supabase: SupabaseClient, request: NextRequest) {
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { success: false, error: 'Shipping zone ID is required' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('shipping_zones')
    .delete()
    .eq('id', body.id);

  if (error) throw error;

  return NextResponse.json({ success: true, message: 'Shipping zone deleted successfully' });
}

export const GET = withAdminAuth((_request, { supabase }) => listShippingZones(supabase));
export const POST = withAdminAuth((request, { supabase }) => createShippingZone(supabase, request));
export const PUT = withAdminAuth((request, { supabase }) => updateShippingZone(supabase, request));
export const DELETE = withAdminAuth((request, { supabase }) => deleteShippingZone(supabase, request));
