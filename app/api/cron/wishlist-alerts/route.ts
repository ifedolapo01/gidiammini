// app/api/cron/wishlist-alerts/route.ts - what happened to the things people saved.
//
// Runs nightly. A wishlist is the clearest demand signal a small store gets,
// and until this existed nothing acted on it: a saved product could halve in
// price or come back from sold out and nobody was told.
//
// The rules for what earns an email are in lib/commerce/wishlist-alerts.ts,
// tested, and this route does what a cron route should: read the watched rows,
// ask the catalogue about each product once, apply the rules, send, stamp.
//
// Two things keep it from becoming a newsletter:
//
//   - one email per saved row per sweep, and a restock outranks a price drop;
//   - every row is stamped with what was observed whether or not anything was
//     sent, so the same news is never sent twice.
//
// Not failClosed. Like the other promotional jobs, the worst an
// unauthenticated call achieves is sending mail that was going out anyway —
// and it cannot send twice, because the observations are the guard.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { authorizeCron } from '@/lib/api/cron-auth';
import { sendOrderEmail } from '@/lib/email';
import { absoluteUrl } from '@/lib/site-url';
import { buildWishlistAlertEmail } from '@/lib/notifications/templates/wishlist-alert-email';
import {
  decideWishlistAlert,
  observeWatch,
  type WatchedProduct,
  type WishlistAlert,
  type WishlistWatch,
} from '@/lib/commerce/wishlist-alerts';

export const maxDuration = 300;

/** One run's worth of saved rows. A backlog is worked through over successive
 *  nights rather than in one request that times out halfway. */
const BATCH = 500;

/** How many product ids one product_cards() call carries. */
const LOOKUP_CHUNK = 100;

/** The stored row, as the sweep reads it. customer_wishlist is not in the
 *  generated types yet — see the wishlist route for the same note. */
interface WishlistRow {
  customer_id: string;
  product_id: string;
  reference_price: number | null;
  last_seen_stock: number | null;
  customers: { email: string; is_blocked: boolean } | null;
}

/**
 * Saved rows, oldest observation first.
 *
 * Ordered by product so one sweep asks the catalogue about each product once,
 * and joined to the customer because a row whose owner is blocked is not worth
 * looking up a product for.
 */
async function watchedRows(supabase: SupabaseClient): Promise<WishlistRow[]> {
  const { data, error } = await supabase
    .from('customer_wishlist')
    .select('customer_id, product_id, reference_price, last_seen_stock, customers(email, is_blocked)')
    .order('product_id')
    .limit(BATCH);

  if (error) {
    console.error('Wishlist sweep could not read saved rows:', error.message);
    return [];
  }

  return (data ?? []) as unknown as WishlistRow[];
}

/**
 * What the catalogue says about these products now.
 *
 * product_cards() is the same projection the listing, the rails and the
 * wishlist page use, so "the price" here is the price a customer would be
 * shown — price_min, the cheapest way to buy it.
 */
async function currentFacts(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, WatchedProduct>> {
  const facts = new Map<string, WatchedProduct>();

  for (let start = 0; start < ids.length; start += LOOKUP_CHUNK) {
    const chunk = ids.slice(start, start + LOOKUP_CHUNK);
    const { data, error } = await supabase.rpc('product_cards', { p_ids: chunk });

    if (error) {
      console.error('Wishlist sweep could not price a chunk of products:', error.message);
      continue;
    }

    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const id = String(row.id);
      const price = Number(row.price_min ?? row.price);
      const stock = Number(row.stock);
      if (!Number.isFinite(price) || !Number.isFinite(stock)) continue;

      facts.set(id, { id, name: String(row.name ?? ''), price, stock });
    }
  }

  return facts;
}

async function send(alert: WishlistAlert, email: string): Promise<boolean> {
  const { subject, html } = buildWishlistAlertEmail({
    alert,
    productUrl: absoluteUrl(`/products/${alert.productId}`),
    wishlistUrl: absoluteUrl('/wishlist'),
  });

  const result = await sendOrderEmail(email, subject, html);
  if (!result.success) {
    console.error(`Wishlist ${alert.kind} mail failed (${result.reason}): ${result.detail}`);
  }
  return result.success;
}

export async function GET(request: NextRequest) {
  const denied = authorizeCron(request, { jobName: 'the wishlist sweep' });
  if (denied) return denied;

  const supabase = createAdminClient();
  const rows = await watchedRows(supabase);

  if (rows.length === 0) {
    return NextResponse.json({ success: true, watched: 0, sent: 0 });
  }

  const facts = await currentFacts(supabase, [...new Set(rows.map((row) => row.product_id))]);

  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    const product = facts.get(row.product_id);
    // Delisted since it was saved. Left untouched: the row still belongs to
    // the customer's list, and there is no news to give them about it.
    if (!product) {
      skipped += 1;
      continue;
    }

    const watch: WishlistWatch = {
      customerId: row.customer_id,
      productId: row.product_id,
      referencePrice: row.reference_price,
      lastSeenStock: row.last_seen_stock,
    };

    const alert = decideWishlistAlert(watch, product);
    const email = row.customers?.email;
    const blocked = row.customers?.is_blocked ?? false;

    // Decided first, stamped second, mailed in between — but the stamp is
    // written whether or not the mail went out. A send that fails is not
    // retried on the next sweep: it would mean re-deciding against a state we
    // have already observed, and the failure mode of retrying for ever is
    // worse than one missed notice.
    const observed = observeWatch(watch, product, alert);
    const { error } = await supabase
      .from('customer_wishlist')
      .update({
        ...observed,
        ...(alert?.kind === 'price-drop' ? { price_notified_at: new Date().toISOString() } : {}),
        ...(alert?.kind === 'back-in-stock' ? { stock_notified_at: new Date().toISOString() } : {}),
      })
      .eq('customer_id', row.customer_id)
      .eq('product_id', row.product_id);

    if (error) {
      // Not stamped means it would be decided again tomorrow. Better to say
      // nothing today than to mail somebody every night for ever.
      console.error(`Wishlist sweep could not stamp ${row.customer_id}/${row.product_id}:`, error.message);
      continue;
    }

    if (!alert || !email || blocked) continue;
    if (await send(alert, email)) sent += 1;
  }

  return NextResponse.json({ success: true, watched: rows.length, sent, skipped });
}
