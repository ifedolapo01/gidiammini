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
//
// A new row also records what the product was like at that moment —
// reference_price and last_seen_stock. Those are never shown to anybody: they
// are the baseline the nightly sweep compares against to decide whether the
// product has since become cheaper or come back into stock. See
// lib/commerce/wishlist-alerts.ts.
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

/**
 * The baseline a new row starts watching from.
 *
 * Taken from the card, so "the price" is the cheapest way to buy it — the same
 * number the customer was looking at when they tapped the heart. A product the
 * lookup could not price starts with nothing, and the first sweep fills it in
 * rather than inventing a change from a state nobody observed.
 */
function baselineFor(card: { price_min?: number | null; price?: number | null; stock?: number | null } | undefined) {
  if (!card) return {};

  const price = Number(card.price_min ?? card.price);
  const stock = Number(card.stock);

  return {
    ...(Number.isFinite(price) ? { reference_price: price } : {}),
    ...(Number.isFinite(stock) ? { last_seen_stock: stock } : {}),
  };
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
  const merged = mergeWishlists(server, local);

  if (merged.length === 0) {
    return NextResponse.json({ success: true, signedIn: true, ids: [], products: [], discounts: [] });
  }

  // One lookup for the whole list: it prices the response, and it supplies the
  // baseline for whatever this browser is bringing that the account has not
  // got.
  const [products, discounts] = await Promise.all([
    loadProductsByIds(merged),
    loadActiveDiscounts(),
  ]);
  const cards = new Map(products.map((product) => [product.id, product]));

  const missing = idsToAdd(server, local);
  if (missing.length > 0) {
    // Only what is new: re-writing existing rows would churn created_at and
    // reshuffle the list under the customer.
    const { error } = await supabase
      .from('customer_wishlist')
      .upsert(
        missing.map((productId) => ({
          customer_id: customer.id,
          product_id: productId,
          ...baselineFor(cards.get(productId)),
        })),
        { onConflict: 'customer_id,product_id', ignoreDuplicates: true }
      );

    // A product id from localStorage that no longer exists violates the
    // foreign key. That is the browser holding something stale, not an error
    // worth failing the sync over.
    if (error) console.warn(`Wishlist sync could not add every product: ${error.message}`);
  }

  return NextResponse.json({ success: true, signedIn: true, ids: merged, products, discounts });
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
  const [card] = await loadProductsByIds([productId]);

  const { error } = await supabase
    .from('customer_wishlist')
    .upsert(
      { customer_id: guard.customer.id, product_id: productId, ...baselineFor(card) },
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
