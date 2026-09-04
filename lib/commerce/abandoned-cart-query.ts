/**
 * COMMERCE layer (server only) — the reminder lifecycle.
 *
 * Everything the cron and the emailed links do: find what is due, mint the
 * link, honour the opt-out, stamp what was sent, and close the sequence when
 * somebody finally buys. Recording the cart in the first place is
 * abandoned-cart-capture.ts, which has different obligations — it is called
 * from a public endpoint while a shopper types.
 *
 * The timing rules are not here. They are pure functions in
 * abandoned-cart.ts, tested, because every one of them is a decision about
 * whether a stranger gets an email.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hashBearerToken, isBearerTokenShape, newBearerToken } from './bearer-token';
import { normaliseEmail } from './customer-identity';
import type { CartItemSnapshot } from './abandoned-cart';

/** Exported for abandoned-cart-capture.ts, the only other module that reads
 *  this table. */
export const ROW_COLUMNS =
  'id, email, full_name, phone, items, abandoned_at, first_sent_at, second_sent_at, recovered_at, opted_out';

export interface AbandonedCartRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  items: CartItemSnapshot[];
  abandoned_at: string;
  first_sent_at: string | null;
  second_sent_at: string | null;
  recovered_at: string | null;
  opted_out: boolean;
}

/** Rotates the resume token and returns the plaintext, for a link about to be
 *  emailed. One live link per send, so an old inbox copy stops working. */
export async function issueResumeToken(
  supabase: SupabaseClient,
  cartId: string
): Promise<string | null> {
  const token = newBearerToken();

  const { error } = await supabase
    .from('abandoned_carts')
    .update({ token_hash: hashBearerToken(token) })
    .eq('id', cartId);

  if (error) {
    console.error(`Could not issue a resume token for cart ${cartId}:`, error.message);
    return null;
  }

  return token;
}

/** The cart behind a resume link, or null. Restores a basket; it is not a
 *  sign-in and carries no account access. */
export async function cartByToken(
  supabase: SupabaseClient,
  token: string | null | undefined
): Promise<AbandonedCartRow | null> {
  if (!isBearerTokenShape(token)) return null;

  const { data, error } = await supabase
    .from('abandoned_carts')
    .select(ROW_COLUMNS)
    .eq('token_hash', hashBearerToken(token as string))
    .maybeSingle();

  if (error) {
    console.error('Resume lookup failed:', error.message);
    return null;
  }

  return (data as unknown as AbandonedCartRow) ?? null;
}

/** "Stop emailing me." Permanent, and it does not need to explain itself. */
export async function optOutByToken(
  supabase: SupabaseClient,
  token: string | null | undefined
): Promise<boolean> {
  const cart = await cartByToken(supabase, token);
  if (!cart) return false;

  const { error } = await supabase
    .from('abandoned_carts')
    .update({ opted_out: true })
    .eq('id', cart.id);

  if (error) {
    console.error(`Opt-out failed for cart ${cart.id}:`, error.message);
    return false;
  }

  return true;
}

/**
 * Carts that might be due, oldest first.
 *
 * The database filters on the permanent stops and on the earliest possible
 * deadline; dueReminder() then decides which email, if any, each row has
 * earned. Splitting it that way keeps the timing rules in one tested place
 * rather than half here in SQL and half there in TypeScript.
 */
export async function cartsPossiblyDue(
  supabase: SupabaseClient,
  earliest: string,
  limit = 100
): Promise<AbandonedCartRow[]> {
  const { data, error } = await supabase
    .from('abandoned_carts')
    .select(ROW_COLUMNS)
    .is('recovered_at', null)
    .eq('opted_out', false)
    .is('second_sent_at', null)
    .lte('abandoned_at', earliest)
    .order('abandoned_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Abandoned cart sweep query failed:', error.message);
    return [];
  }

  return (data ?? []) as unknown as AbandonedCartRow[];
}

/** Stamped whether or not the mail was delivered — a permanently bad address
 *  must not be retried on every run forever. Same rule as the payment
 *  reminders. */
export async function markReminderSent(
  supabase: SupabaseClient,
  cartId: string,
  which: 'first' | 'second'
): Promise<void> {
  const column = which === 'first' ? 'first_sent_at' : 'second_sent_at';

  const { error } = await supabase
    .from('abandoned_carts')
    .update({ [column]: new Date().toISOString() })
    .eq('id', cartId);

  if (error) console.error(`Could not stamp ${column} on cart ${cartId}:`, error.message);
}

/**
 * They bought. Called from the order-created effects, so the reminder cannot
 * arrive after the thing it is reminding them to do.
 */
export async function markCartRecovered(
  supabase: SupabaseClient,
  email: string
): Promise<void> {
  const normalised = normaliseEmail(email);
  if (!normalised) return;

  const { error } = await supabase
    .from('abandoned_carts')
    .update({ recovered_at: new Date().toISOString() })
    .eq('email', normalised)
    .is('recovered_at', null);

  // Nothing to mark is the common case — most orders never had a recorded
  // cart. Only a real failure is worth a line.
  if (error) console.error(`Could not mark a cart recovered for ${normalised}:`, error.message);
}
