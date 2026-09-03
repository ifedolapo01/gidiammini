// app/api/admin/products/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth } from '@/lib/api/with-admin-auth';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function getProduct(supabase: SupabaseClient, id: string) {
  console.log('📱 Fetching single product');

  console.log('Product ID from params:', id);

  if (!id || id === 'undefined') {
    return NextResponse.json(
      { success: false, error: 'Product ID is required' },
      { status: 400, headers: JSON_HEADERS }
    );
  }

  // Get product
  const { data, error } = await supabase
    .from('products')
    // Variants embedded: the edit form reads cost from them, which
    // pricing_config cannot carry.
    .select('*, product_variants(*)')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error('Supabase error:', error);

    if (error.code === 'PGRST116') {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404, headers: JSON_HEADERS }
      );
    }

    throw error;
  }

  if (!data) {
    return NextResponse.json(
      { success: false, error: 'Product not found' },
      { status: 404, headers: JSON_HEADERS }
    );
  }

  console.log('✅ Product found:', data.id);

  return NextResponse.json(
    { success: true, product: data },
    { headers: JSON_HEADERS }
  );
}

export const GET = withAdminAuth(async (_request, { supabase, params }) => {
  const { id } = await params;
  return getProduct(supabase, id);
});
