// app/api/cron/abandoned-carts/route.ts - the two reminder emails.
//
// Runs hourly, because the first email is due an hour after the cart was last
// touched and a daily sweep would turn that into "sometime tomorrow". The
// timing rules themselves are in lib/commerce/abandoned-cart.ts, tested, and
// this route only does what a cron route should: find candidates, ask what
// each one has earned, send, stamp.
//
// SCHEDULED FROM POSTGRES, NOT vercel.json. Deliberately: Vercel's Hobby plan
// rejects any sub-daily cron expression at deploy time, so an hourly entry
// there is a failed deployment rather than a slower job. pg_cron calls this
// endpoint instead — see supabase/scheduled-jobs/abandoned-carts.sql. Every
// other cron in this directory is daily and still lives in vercel.json.
//
// Not failClosed. Like the other promotional jobs, the worst an
// unauthenticated call achieves is sending mail that was going out anyway —
// and it cannot send twice, because the stamps are the guard.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { authorizeCron } from '@/lib/api/cron-auth';
import { sendOrderEmail } from '@/lib/email';
import { absoluteUrl } from '@/lib/site-url';
import { buildAbandonedCartEmail } from '@/lib/notifications/templates/abandoned-cart-email';
import { PUBLIC_VARIANTS_SELECT } from '@/lib/commerce/product-variants';
import {
  buildCartEmailLines,
  dueReminder,
  FIRST_REMINDER_HOURS,
} from '@/lib/commerce/abandoned-cart';
import {
  cartsPossiblyDue,
  issueResumeToken,
  markReminderSent,
  type AbandonedCartRow,
} from '@/lib/commerce/abandoned-cart-query';
import type { Product } from '@/types/product';

export const maxDuration = 300;

/** One run's worth. A backlog is worked through over successive hours rather
 *  than in one request that times out halfway and leaves half the rows
 *  stamped. */
const BATCH = 50;

/** The products in one cart, with variants, so the email prices the exact
 *  size and colour that was chosen. */
async function productsFor(supabase: SupabaseClient, cart: AbandonedCartRow): Promise<Product[]> {
  const ids = [...new Set(cart.items.map((item) => item.product_id))];
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from('products')
    .select(`*,${PUBLIC_VARIANTS_SELECT}`)
    .in('id', ids);

  return (data ?? []) as unknown as Product[];
}

async function remind(supabase: SupabaseClient, cart: AbandonedCartRow, stage: 'first' | 'second') {
  const { lines, subtotal } = buildCartEmailLines(cart.items, await productsFor(supabase, cart));

  // Everything in the basket is gone or sold out. Stamped anyway, so the row
  // stops being considered — there is no version of "come back for the thing
  // we no longer have" worth sending.
  if (lines.length === 0) {
    await markReminderSent(supabase, cart.id, stage);
    return false;
  }

  // Rotated per send, so the link in an older reminder stops working.
  const token = await issueResumeToken(supabase, cart.id);
  if (!token) return false;

  const { subject, html } = buildAbandonedCartEmail({
    customerName: cart.full_name,
    lines,
    subtotal,
    resumeUrl: absoluteUrl(`/cart/resume?token=${encodeURIComponent(token)}`),
    optOutUrl: absoluteUrl(`/cart/resume?token=${encodeURIComponent(token)}&stop=1`),
    stage,
  });

  const outcome = await sendOrderEmail(cart.email, subject, html);

  // Stamped whether or not it was delivered: a permanently bad address must
  // not be retried every hour forever. Same rule as the payment reminders.
  await markReminderSent(supabase, cart.id, stage);

  if (!outcome.success) {
    console.error(`Abandoned cart ${stage} email failed for ${cart.email}: ${outcome.reason}`);
  }

  return outcome.success;
}

export async function GET(req: NextRequest) {
  const denied = authorizeCron(req, { jobName: 'the abandoned cart sweep' });
  if (denied) return denied;

  try {
    // Typed loosely until `npm run db:types` reruns against a database that
    // has migration 004000.
    const supabase: SupabaseClient = createAdminClient();

    // The earliest a row could be due at all. dueReminder() decides which of
    // the two, if either, each one has actually earned.
    const earliest = new Date(Date.now() - FIRST_REMINDER_HOURS * 3_600_000).toISOString();
    const candidates = await cartsPossiblyDue(supabase, earliest, BATCH);

    let sent = 0;
    let skipped = 0;

    for (const cart of candidates) {
      const stage = dueReminder(cart);
      if (!stage) {
        skipped++;
        continue;
      }

      if (await remind(supabase, cart, stage)) sent++;
    }

    console.log(
      `Abandoned cart sweep: ${sent} reminder(s) sent, ${skipped} not yet due, ${candidates.length} considered.`
    );

    return NextResponse.json({ success: true, sent, skipped, considered: candidates.length });
  } catch (error: any) {
    console.error('Abandoned cart cron error:', error);
    return NextResponse.json(
      { success: false, error: 'Sweep failed.', detail: error.message },
      { status: 500 }
    );
  }
}
