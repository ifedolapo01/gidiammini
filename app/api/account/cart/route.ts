// app/api/account/cart/route.ts - the cart that follows the customer.
//
// Two verbs on one resource:
//
//   POST  syncs. The browser sends what it holds, the server merges it with
//         the account's stored cart — same line (product+size+color) keeps
//         the LARGER quantity, not the sum, see mergeCartsMax — and answers
//         with the whole merged cart, priced from today's catalogue. This is
//         the call that runs on every page load, and for a signed-out
//         browser it costs no database read at all. See optionalCustomer.
//   PUT   replaces. Sends the browser's *entire* current cart, debounced
//         while quantities are being edited. Full-replace rather than a
//         per-line endpoint because the caller (useCartSync) already holds
//         the whole cart in state and is going to push it after every batch
//         of edits anyway — no separate remove-one-line verb is needed, a
//         line simply isn't present in the array it sends.
//
// Only ids and quantity are ever stored — never price, name or image, which
// this route always re-resolves from the live catalogue. See cart-sync.ts.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { optionalCustomer, requireCustomer } from '@/lib/api/customer-session';
import { PUBLIC_VARIANTS_SELECT } from '@/lib/commerce/product-variants';
import type { Product } from '@/types/product';
import {
  sanitiseCartLines,
  mergeCartsMax,
  linesToUpsert,
  resolveCartLines,
} from '@/lib/commerce/cart-sync';
import { type CartLineInput, MAX_CART_LINES } from '@/lib/commerce/cart-input';

interface CartRow {
  product_id: string;
  size: string;
  color: string;
  quantity: number;
}

/** '' in the database, null in application code — the same empty-slot
 *  sentinel cartLineKey() already uses (`size ?? ''`), coerced once here so
 *  every call site downstream agrees. */
function fromRow(row: CartRow): CartLineInput {
  return {
    product_id: row.product_id,
    size: row.size || null,
    color: row.color || null,
    quantity: row.quantity,
  };
}

function toRow(customerId: string, line: CartLineInput) {
  return {
    customer_id: customerId,
    product_id: line.product_id,
    size: line.size ?? '',
    color: line.color ?? '',
    quantity: line.quantity,
    updated_at: new Date().toISOString(),
  };
}

/** Typed loosely until `npm run db:types` reruns against a database that has
 *  this migration — customer_cart is not in the generated types yet. */
async function storedLines(supabase: SupabaseClient, customerId: string): Promise<CartLineInput[]> {
  const { data, error } = await supabase
    .from('customer_cart')
    .select('product_id, size, color, quantity')
    .eq('customer_id', customerId)
    .limit(MAX_CART_LINES);

  if (error) {
    console.error(`Cart read failed for ${customerId}:`, error.message);
    return [];
  }

  return ((data ?? []) as CartRow[]).map(fromRow);
}

async function pricedItems(supabase: SupabaseClient, lines: CartLineInput[]) {
  if (lines.length === 0) return [];

  const { data } = await supabase
    .from('products')
    .select(`*,${PUBLIC_VARIANTS_SELECT}`)
    .in('id', [...new Set(lines.map((line) => line.product_id))]);

  return resolveCartLines(lines, (data ?? []) as unknown as Product[]);
}

export async function POST(request: NextRequest) {
  // Runs on every page load through CartProvider, and most visitors are
  // guests — answered rather than refused. See optionalCustomer.
  const customer = await optionalCustomer(request);
  if (!customer) {
    return NextResponse.json({ success: true, signedIn: false, items: [] });
  }

  const supabase: SupabaseClient = createAdminClient();
  const body = await request.json().catch(() => null);
  const local = mergeCartsMax([], sanitiseCartLines(body?.lines));

  const server = await storedLines(supabase, customer.id);
  const merged = mergeCartsMax(server, local);

  const delta = linesToUpsert(server, merged);
  if (delta.length > 0) {
    const { error } = await supabase
      .from('customer_cart')
      .upsert(
        delta.map((line) => toRow(customer.id, line)),
        { onConflict: 'customer_id,product_id,size,color' }
      );

    // A product id from localStorage that no longer exists violates the
    // foreign key. That is the browser holding something stale, not an error
    // worth failing the sync over.
    if (error) console.warn(`Cart sync could not save every line: ${error.message}`);
  }

  const items = await pricedItems(supabase, merged);
  return NextResponse.json({ success: true, signedIn: true, items });
}

export async function PUT(request: NextRequest) {
  const guard = await requireCustomer(request);
  if (!guard.ok) return guard.response;

  const supabase: SupabaseClient = createAdminClient();
  const body = await request.json().catch(() => null);
  const lines = mergeCartsMax([], sanitiseCartLines(body?.lines));

  const { error: deleteError } = await supabase
    .from('customer_cart')
    .delete()
    .eq('customer_id', guard.customer.id);

  if (deleteError) {
    console.error(`Cart replace failed for ${guard.customer.id}:`, deleteError.message);
    return NextResponse.json({ success: false, error: 'Could not save your cart.' }, { status: 503 });
  }

  if (lines.length > 0) {
    const { error: insertError } = await supabase
      .from('customer_cart')
      .insert(lines.map((line) => toRow(guard.customer.id, line)));

    if (insertError) {
      console.error(`Cart replace failed for ${guard.customer.id}:`, insertError.message);
      return NextResponse.json({ success: false, error: 'Could not save your cart.' }, { status: 503 });
    }
  }

  return NextResponse.json({ success: true });
}
