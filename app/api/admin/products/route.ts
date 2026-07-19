// app/api/admin/products/route.ts - UPDATED FOR COMPLETE CRUD
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth } from '@/lib/api/with-admin-auth';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function listProducts(supabase: SupabaseClient) {
  console.log('📱 Fetching all products');

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return NextResponse.json({ success: true, products: data }, { headers: JSON_HEADERS });
}

async function createProduct(supabase: SupabaseClient, request: NextRequest) {
  console.log('📱 Creating new product');

  const body = await request.json();

  if (!body.name || body.price === undefined || body.price === null || !body.main_image) {
    return NextResponse.json(
      { success: false, error: 'Product name, price and image are required' },
      { status: 400, headers: JSON_HEADERS }
    );
  }

  const productData = {
    name: body.name.substring(0, 100),
    description: (body.description || '').substring(0, 500),
    price: Number(body.price),
    category: body.category || 'babies',
    main_image: body.main_image || '',
    images: body.images || [],
    colors: body.colors || [],
    sizes: body.sizes || [],
    sizing_type: body.sizing_type || 'size',
    details: body.details || [],
    sub_category: body.sub_category || null,
    pricing_config: body.pricing_config || null,
    stock: Number(body.stock) || 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  console.log('Creating product:', productData.name);

  const { data, error } = await supabase
    .from('products')
    .insert([productData])
    .select()
    .single();

  if (error) throw error;

  console.log('✅ Product created:', data.id);

  return NextResponse.json(
    { success: true, product: data, message: 'Product created successfully' },
    { headers: JSON_HEADERS }
  );
}

async function updateProduct(supabase: SupabaseClient, request: NextRequest) {
  console.log('📱 Updating product');

  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { success: false, error: 'Product ID is required' },
      { status: 400, headers: JSON_HEADERS }
    );
  }

  const updateData = {
    name: body.name.substring(0, 100),
    description: (body.description || '').substring(0, 500),
    price: Number(body.price),
    category: body.category || 'babies',
    main_image: body.main_image,
    images: body.images || [],
    colors: body.colors || [],
    sizes: body.sizes || [],
    sizing_type: body.sizing_type || 'size',
    details: body.details || [],
    sub_category: body.sub_category || null,
    pricing_config: body.pricing_config || null,
    stock: Number(body.stock) || 0,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', body.id)
    .select()
    .single();

  if (error) throw error;

  console.log('✅ Product updated:', body.id);

  return NextResponse.json(
    { success: true, product: data, message: 'Product updated successfully' },
    { headers: JSON_HEADERS }
  );
}

async function deleteProduct(supabase: SupabaseClient, request: NextRequest) {
  console.log('📱 Deleting product');

  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { success: false, error: 'Product ID is required' },
      { status: 400, headers: JSON_HEADERS }
    );
  }

  // Soft delete (set is_active to false)
  const { error } = await supabase
    .from('products')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', body.id);

  if (error) throw error;

  console.log('✅ Product deleted:', body.id);

  return NextResponse.json(
    { success: true, message: 'Product deleted successfully' },
    { headers: JSON_HEADERS }
  );
}

export const GET = withAdminAuth((_request, { supabase }) => listProducts(supabase));
export const POST = withAdminAuth((request, { supabase }) => createProduct(supabase, request));
export const PUT = withAdminAuth((request, { supabase }) => updateProduct(supabase, request));
export const DELETE = withAdminAuth((request, { supabase }) => deleteProduct(supabase, request));
