/**
 * COMMERCE layer (server only) — recording the basket while somebody shops.
 *
 * Split from abandoned-cart-query.ts, which is now the reminder lifecycle —
 * what the cron and the emailed links do. This is the one write that comes
 * from a public endpoint, called repeatedly as a shopper types, and it has
 * different obligations because of it: cheap, idempotent, and above all unable
 * to restart a reminder sequence just because somebody came back to browse.
 *
 * Best-effort, like everything on this path. A cart that fails to save is a
 * marketing email nobody gets; a checkout that fails because the marketing
 * table was unreachable is a sale nobody makes.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hashBearerToken, newBearerToken } from './bearer-token';
import { normaliseEmail } from './customer-identity';
import { sanitiseCartItems, shouldRestartSequence } from './abandoned-cart';
import { ROW_COLUMNS, type AbandonedCartRow } from './abandoned-cart-query';

export interface CaptureInput {
  email: string;
  name?: string | null;
  phone?: string | null;
  items: unknown;
}

/**
 * Records — or refreshes — the cart for this address.
 *
 * Read-then-write rather than a blind upsert, because three of the columns
 * depend on what is already there: the token has to survive (links already in
 * an inbox must keep working), and the send stamps must only be cleared when
 * the previous sequence is genuinely old.
 */
export async function captureCart(
  supabase: SupabaseClient,
  input: CaptureInput
): Promise<{ captured: boolean }> {
  const email = normaliseEmail(input.email);
  const items = sanitiseCartItems(input.items);

  // An empty basket is not an abandoned cart. It is also what a shopper who
  // has just emptied theirs looks like, and mailing them about nothing would
  // be worse than silence.
  if (!email || items.length === 0) return { captured: false };

  const now = new Date().toISOString();
  const shared = {
    full_name: input.name?.trim() || null,
    phone: input.phone?.trim() || null,
    items,
    abandoned_at: now,
  };

  const { data: existing } = await supabase
    .from('abandoned_carts')
    .select(ROW_COLUMNS)
    .eq('email', email)
    .maybeSingle();

  const row = existing as unknown as AbandonedCartRow | null;

  if (!row) {
    // Link to a known buyer if there is one. Never creates a customer: an
    // abandoned cart is not a relationship, and inventing an identity for
    // somebody who has not bought would put strangers in the customers table.
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    const { error } = await supabase.from('abandoned_carts').insert({
      email,
      customer_id: (customer as { id: string } | null)?.id ?? null,
      // A placeholder token, never returned to anybody: the resume link is
      // built by the cron, which rotates this at send time. Handing the
      // plaintext back from a public endpoint would put a working cart link in
      // a response anyone can trigger for any address.
      token_hash: hashBearerToken(newBearerToken()),
      ...shared,
    });

    // Two tabs racing produces a unique violation on email. Whichever lost
    // simply refreshes the winner's row on the next capture; the shopper is
    // still shopping, so there will be one.
    if (error && error.code !== '23505') {
      console.error(`Could not record an abandoned cart for ${email}:`, error.message);
      return { captured: false };
    }

    return { captured: true };
  }

  // A returning shopper. The sequence only starts over if the last contact is
  // old — otherwise browsing weekly would mean being reminded weekly.
  const restart = shouldRestartSequence(row);

  const { error } = await supabase
    .from('abandoned_carts')
    .update({
      ...shared,
      ...(restart ? { first_sent_at: null, second_sent_at: null, recovered_at: null } : {}),
    })
    .eq('id', row.id);

  if (error) {
    console.error(`Could not refresh the abandoned cart for ${email}:`, error.message);
    return { captured: false };
  }

  return { captured: true };
}
