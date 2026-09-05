// app/api/admin/products/route.ts - UPDATED FOR COMPLETE CRUD
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth, type AuditRecorder } from '@/lib/api/with-admin-auth';
import { diffForAudit, isEmptyDiff, withoutTimestamps } from '@/lib/api/audit';
import { syncVariants, applyVariantCosts } from './product-write';
import {
  buildProductCreatePayload,
  buildProductUpdatePayload,
} from '@/lib/commerce/product-payload';
import { fetchAdminProducts } from '@/lib/commerce/admin-products-query';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * GET — the admin products list, one page at a time.
 *
 * Accepts ?page, ?limit, ?search, ?category, ?subCategory, ?status, ?stock,
 * ?lowStockThreshold, ?sort and ?direction. It used to select every active
 * product with every variant embedded and no limit, and the client filtered
 * and searched that in JavaScript on a 60-second loop.
 *
 * Variants stay embedded: flattenProducts renders one row per variant from
 * them, so they are the table's content rather than a detail fetched on
 * expansion. Only the columns the tables read are selected.
 */
async function listProducts(supabase: SupabaseClient, request: NextRequest) {
  try {
    const { products, meta } = await fetchAdminProducts(supabase, new URL(request.url));
    return NextResponse.json({ success: true, products, meta }, { headers: JSON_HEADERS });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load products', products: [] },
      { status: 500, headers: JSON_HEADERS }
    );
  }
}

async function createProduct(supabase: SupabaseClient, request: NextRequest, audit: AuditRecorder) {
  console.log('📱 Creating new product');

  const body = await request.json();

  if (!body.name || body.price === undefined || body.price === null || !body.main_image) {
    return NextResponse.json(
      { success: false, error: 'Product name, price and image are required' },
      { status: 400, headers: JSON_HEADERS }
    );
  }

  const productData = buildProductCreatePayload(body);

  console.log('Creating product:', productData.name);

  const { data, error } = await supabase
    .from('products')
    .insert([productData])
    .select()
    .single();

  if (error) throw error;

  await syncVariants(supabase, data.id);
  await applyVariantCosts(supabase, data.id, body.variant_costs);

  audit({ entityType: 'product', entityId: data.id, action: 'create', after: data });

  console.log('✅ Product created:', data.id);

  return NextResponse.json(
    { success: true, product: data, message: 'Product created successfully' },
    { headers: JSON_HEADERS }
  );
}

async function updateProduct(supabase: SupabaseClient, request: NextRequest, audit: AuditRecorder) {
  console.log('📱 Updating product');

  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { success: false, error: 'Product ID is required' },
      { status: 400, headers: JSON_HEADERS }
    );
  }

  // Read the row before changing it. Nothing needed this until now, but "the
  // price is wrong, what was it before" is unanswerable without it.
  const { data: previous } = await supabase
    .from('products')
    .select('*')
    .eq('id', body.id)
    .maybeSingle();

  // Only the fields this request actually mentioned. Building a whole row here
  // is what let a partial update wipe sizes, colours, stock and the image.
  const updateData = buildProductUpdatePayload(body);

  const { data, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', body.id)
    .select()
    .single();

  if (error) throw error;

  await syncVariants(supabase, body.id);
  await applyVariantCosts(supabase, body.id, body.variant_costs);

  // Only the fields that moved. A save that changed nothing records nothing,
  // so the feed shows real edits rather than every time someone opened a form
  // and pressed save.
  const diff = withoutTimestamps(diffForAudit(previous ?? null, data));
  if (!isEmptyDiff(diff)) {
    audit({
      entityType: 'product',
      entityId: body.id,
      action: 'update',
      before: diff.before,
      after: diff.after,
      reason: typeof body.reason === 'string' ? body.reason : null,
    });
  }

  console.log('✅ Product updated:', body.id);

  return NextResponse.json(
    { success: true, product: data, message: 'Product updated successfully' },
    { headers: JSON_HEADERS }
  );
}

async function deleteProduct(supabase: SupabaseClient, request: NextRequest, audit: AuditRecorder) {
  console.log('📱 Deleting product');

  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { success: false, error: 'Product ID is required' },
      { status: 400, headers: JSON_HEADERS }
    );
  }

  const { data: previous } = await supabase
    .from('products')
    .select('id, name, price, stock, is_active, category')
    .eq('id', body.id)
    .maybeSingle();

  // Soft delete (set is_active to false)
  const { error } = await supabase
    .from('products')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', body.id);

  if (error) throw error;

  audit({
    entityType: 'product',
    entityId: body.id,
    action: 'delete',
    before: previous,
    reason: typeof body.reason === 'string' ? body.reason : null,
  });

  console.log('✅ Product deleted:', body.id);

  return NextResponse.json(
    { success: true, message: 'Product deleted successfully' },
    { headers: JSON_HEADERS }
  );
}

export const GET = withAdminAuth((request, { supabase }) => listProducts(supabase, request));
export const POST = withAdminAuth((request, { supabase, audit }) => createProduct(supabase, request, audit));
export const PUT = withAdminAuth((request, { supabase, audit }) => updateProduct(supabase, request, audit));
export const DELETE = withAdminAuth((request, { supabase, audit }) => deleteProduct(supabase, request, audit));
