// app/api/cron/product-pairs/route.ts - the nightly co-purchase rebuild.
//
// Recomputes product_pairs from every paid order, which is what the cart's
// "Customers also bought" reads. Nightly is the right cadence: the input only
// changes when an order is placed, and a suggestion a day behind the order book
// is indistinguishable from a current one.
//
// Fails closed. The rebuild deletes and repopulates a table, so an unprotected
// URL would be a free way to make the database recompute on demand.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { authorizeCron } from '@/lib/api/cron-auth';
import { revalidateProductListings } from '@/lib/commerce/product-listing';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = authorizeCron(req, { failClosed: true, jobName: 'the co-purchase rebuild' });
  if (denied) return denied;

  try {
    // Loose typing until `npm run db:types` reruns against a database that has
    // migration 003200 — rebuild_product_pairs is not in the generated types.
    const supabase: SupabaseClient = createAdminClient();

    const { data, error } = await supabase.rpc('rebuild_product_pairs', { p_min_orders: 1 });
    if (error) throw new Error(error.message);

    const pairs = Number(data ?? 0);
    console.log(`Co-purchase rebuild wrote ${pairs} pairs.`);

    // The cart rail is cached under the products tag. Without this, last
    // night's pairs would stay visible for the cache window after the rebuild
    // that replaced them.
    revalidateProductListings();

    return NextResponse.json({ success: true, pairs });
  } catch (error: any) {
    console.error('Co-purchase rebuild failed:', error);
    return NextResponse.json(
      { success: false, error: 'Rebuild failed.', detail: error.message },
      { status: 500 }
    );
  }
}
