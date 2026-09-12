// app/api/admin/products/[id]/route.ts
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { logger } from '@/lib/logger';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function getProduct(supabase: SupabaseClient, id: string) {
  logger.debug('admin: fetching product');

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
    // Variants embedded: the edit form reads price/stock/cost/images from them.
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

  // The customer side of the fit story, next to the admin's own claim on
  // the form below. Best-effort: a missing or errored row just means no
  // reviews have answered the fit question yet, not a reason to fail the
  // product load.
  const { data: fitStats } = await supabase
    .from('product_review_stats')
    .select('runs_small_count, true_to_size_count, runs_large_count')
    .eq('product_id', id)
    .maybeSingle();

  return NextResponse.json(
    { success: true, product: data, reviewFitStats: fitStats ?? null },
    { headers: JSON_HEADERS }
  );
}

export const GET = withAdminAuth(async (_request, { supabase, params }) => {
  const { id } = await params;
  return getProduct(supabase, id);
});
