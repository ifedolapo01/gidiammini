// app/api/account/wishlist/route.ts - the wishlist that follows the customer.
//
// Three verbs on one resource:
//
//   POST   syncs. The browser sends what it holds, the server unions it in and
//          answers with the whole list as product cards. This is the call that
//          runs on every page load, and for a signed-out browser it is a 401
//          with no database read at all.
//   PUT    adds one product, for a heart tapped while signed in.
//   DELETE removes one, which has to be explicit and immediate — the merge is
//          a union, so a removal that only happened locally would come back on
//          the next sync.
//
// The cards come from product_cards() via loadProductsByIds, the same
// projection the listing and the rails use, so a saved product shows today's
// price and stock rather than what it cost when it was hearted.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { optionalCustomer, requireCustomer } from '@/lib/api/customer-session';
import { loadProductsByIds, loadActiveDiscounts } from '@/lib/commerce/recommendations';
import {
  idsToAdd,
  mergeWishlists,
  sanitiseWishlistIds,
  MAX_WISHLIST_IDS,
} from '@/lib/commerce/wishlist-sync';

/** Typed loosely until `npm run db:types` reruns against a database that has
 *  migration 003700 — customer_wishlist is not in the generated types yet. */
async function savedIds(supabase: SupabaseClient, customerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('customer_wishlist')
    .select('product_id')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(MAX_WISHLIST_IDS);

  if (error) {
    console.error(`Wishlist read failed for ${customerId}:`, error.message);
    return [];
  }

  return ((data ?? []) as Array<{ product_id: string }>).map((row) => row.product_id);
}

/** The list as cards, plus the discounts that price them. Products that have
 *  been delisted simply drop out — product_cards() filters on is_active. */
async function listResponse(supabase: SupabaseClient, ids: string[]) {
  if (ids.length === 0) {
    return NextResponse.json({ success: true, signedIn: true, ids: [], products: [], discounts: [] });
  }

  const [products, discounts] = await Promise.all([
    loadProductsByIds(ids),
    loadActiveDiscounts(),
  ]);

  return NextResponse.json({ success: true, signedIn: true, ids, products, discounts });
}

export async function POST(request: NextRequest) {
  // Runs on every page load through WishlistProvider, and most visitors are
  // guests — answered rather than refused. See optionalCustomer.
  const customer = await optionalCustomer(request);
  if (!customer) {
    return NextResponse.json({ success: true, signedIn: false, ids: [], products: [], discounts: [] });
  }

  const supabase: SupabaseClient = createAdminClient();
  const body = await request.json().catch(() => null);
  const local = sanitiseWishlistIds(body?.ids);

  const server = await savedIds(supabase, customer.id);
  const missing = idsToAdd(server, local);

  if (missing.length > 0) {
    // Only what is new: re-writing existing rows would churn created_at and
    // reshuffle the list under the customer.
    const { error } = await supabase
      .from('customer_wishlist')
      .upsert(
        missing.map((productId) => ({ customer_id: customer.id, product_id: productId })),
        { onConflict: 'customer_id,product_id', ignoreDuplicates: true }
      );

    // A product id from localStorage that no longer exists violates the
    // foreign key. That is the browser holding something stale, not an error
    // worth failing the sync over.
    if (error) console.warn(`Wishlist sync could not add every product: ${error.message}`);
  }

  return listResponse(supabase, mergeWishlists(server, local));
}

export async function PUT(request: NextRequest) {
  const guard = await requireCustomer(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const [productId] = sanitiseWishlistIds([body?.productId]);
  if (!productId) {
    return NextResponse.json({ success: false, error: 'No product given.' }, { status: 400 });
  }

  const supabase: SupabaseClient = createAdminClient();
  const { error } = await supabase
    .from('customer_wishlist')
    .upsert(
      { customer_id: guard.customer.id, product_id: productId },
      { onConflict: 'customer_id,product_id', ignoreDuplicates: true }
    );

  if (error) {
    console.error(`Wishlist add failed for ${guard.customer.id}:`, error.message);
    return NextResponse.json({ success: false, error: 'Could not save that.' }, { status: 503 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireCustomer(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const [productId] = sanitiseWishlistIds([body?.productId]);
  if (!productId) {
    return NextResponse.json({ success: false, error: 'No product given.' }, { status: 400 });
  }

  const supabase: SupabaseClient = createAdminClient();
  const { error } = await supabase
    .from('customer_wishlist')
    .delete()
    .eq('customer_id', guard.customer.id)
    .eq('product_id', productId);

  if (error) {
    console.error(`Wishlist remove failed for ${guard.customer.id}:`, error.message);
    return NextResponse.json({ success: false, error: 'Could not remove that.' }, { status: 503 });
  }

  return NextResponse.json({ success: true });
}
