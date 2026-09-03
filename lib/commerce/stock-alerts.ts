/**
 * COMMERCE layer (server only) — draining the stock_alerts queue on a restock.
 *
 * Called from the admin stock save. The admin does nothing to trigger it and
 * sees nothing about it in the form they submitted: the point of the feature is
 * that raising a number from 0 mails everyone who asked, without anybody having
 * to remember.
 *
 * Three rules hold it together:
 *
 *   1. Only a 0 → positive transition fires. Editing 4 to 6 restocks nothing
 *      that was unavailable, and mailing on it would train people to ignore the
 *      mail.
 *   2. Rows are claimed before they are sent, not after. A crash mid-send
 *      leaves them marked notified and some people unmailed, which is a much
 *      better failure than an unclaimed queue that mails everyone twice on the
 *      next save.
 *   3. Nothing here can fail the save. The stock change is the admin's
 *      instruction and it has already happened; a mail server being down must
 *      not turn that into an error they retry.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendOrderEmail } from '@/lib/email';
import { buildBackInStockEmail } from '@/lib/notifications/templates/back-in-stock-email';
import { absoluteUrl } from '@/lib/site-url';
import { isRestock } from './stock';

export interface RestockNotificationResult {
  /** How many pending alerts were claimed for this product. */
  claimed: number;
  sent: number;
  failed: number;
}

const NOTHING: RestockNotificationResult = { claimed: 0, sent: 0, failed: 0 };

function productUrl(productId: string): string {
  return absoluteUrl(`/products/${productId}`);
}

/**
 * Mails everyone waiting on this product, once.
 *
 * Claiming is a conditional UPDATE returning the rows it changed, so two
 * concurrent restock saves cannot both pick up the same alert — whichever
 * commits second updates nothing and mails nobody.
 */
export async function notifyRestock(
  supabase: SupabaseClient,
  productId: string,
  variantLabel?: string | null
): Promise<RestockNotificationResult> {
  const claimedAt = new Date().toISOString();

  const { data: claimed, error } = await supabase
    .from('stock_alerts')
    .update({ notified_at: claimedAt })
    .eq('product_id', productId)
    .is('notified_at', null)
    .select('id, email');

  if (error) {
    console.error(`Stock alert claim failed for product ${productId}:`, error.message);
    return NOTHING;
  }

  const alerts = (claimed ?? []) as Array<{ id: string; email: string }>;
  if (alerts.length === 0) return NOTHING;

  const { data: product } = await supabase
    .from('products')
    .select('name')
    .eq('id', productId)
    .maybeSingle();

  const { subject, html } = buildBackInStockEmail({
    productName: (product?.name as string) ?? 'Your saved product',
    productUrl: productUrl(productId),
    variantLabel,
  });

  // One mail each rather than one bulk send, so a single bad address cannot
  // take the whole batch down with it — and so nobody sees anyone else's.
  const results = await Promise.all(
    alerts.map(async (alert) => {
      const outcome = await sendOrderEmail(alert.email, subject, html);
      if (!outcome.success) {
        console.error(`Back-in-stock email failed for ${alert.id}: ${outcome.reason}`);
      }
      return outcome.success;
    })
  );

  const sent = results.filter(Boolean).length;
  return { claimed: alerts.length, sent, failed: alerts.length - sent };
}

/**
 * The wrapper the admin routes call: checks the transition, then mails.
 *
 * Swallows everything. See rule 3 — the stock change has already committed and
 * this must never be the reason a save reports failure.
 */
export async function notifyIfRestocked(
  supabase: SupabaseClient,
  productId: string,
  previousStock: number | null | undefined,
  newStock: number,
  variantLabel?: string | null
): Promise<RestockNotificationResult> {
  if (!isRestock(previousStock, newStock)) return NOTHING;

  try {
    return await notifyRestock(supabase, productId, variantLabel);
  } catch (cause) {
    console.error(`Restock notification failed for product ${productId}:`, cause);
    return NOTHING;
  }
}
