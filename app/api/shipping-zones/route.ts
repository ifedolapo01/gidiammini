import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 60; // Cache for 60 seconds

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // We use anon key for public data
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });

    const { data, error } = await supabase
      .from('shipping_zones')
      .select('*, shipping_zone_exceptions(*)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, zones: data });
  } catch (error: any) {
    console.error('Error fetching public shipping zones:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch shipping zones' },
      { status: 500 }
    );
  }
}
