/**
 * COMMERCE layer (server only) — signing a customer in without a password.
 *
 * The whole flow, and the rules that keep it safe:
 *
 *   1. Asking is not an oracle. requestSignInLink answers the same way whether
 *      the contact matched a customer, several, or nobody — otherwise the
 *      endpoint becomes a way to ask "does this person shop here", of a shop
 *      selling baby clothes.
 *
 *   2. The link goes to the email on file, never to an address supplied in the
 *      request. Sending to what was typed would let anyone name a victim's
 *      phone number and their own inbox.
 *
 *   3. An ambiguous contact identifies nobody — see customer-lookup.ts.
 *
 *   4. Redemption is single use, short lived, and what mints the session.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendOrderEmail } from '@/lib/email';
import { buildSignInLinkEmail } from '@/lib/notifications/templates/sign-in-link-email';
import { absoluteUrl } from '@/lib/site-url';
import { hashBearerToken, isBearerTokenShape, newBearerToken } from './bearer-token';
import type { Contact } from './customer-account';
import {
  findCustomer,
  toCustomer,
  CUSTOMER_COLUMNS,
  type CustomerRow,
  type SignedInCustomer,
} from './customer-lookup';

// Re-exported: a caller that needs the signed-in customer's shape is reaching
// for it because of this module's functions, not because of the lookup's.
export type { SignedInCustomer };

/**
 * What the sign-in endpoint says, which is nothing.
 *
 * An earlier version returned the masked destination when a mail had actually
 * gone out. That was a mistake: present-or-absent is itself the answer, so the
 * response leaked exactly what rule 1 exists to withhold — type an address,
 * learn whether that person shops at a baby store. The copy now covers the
 * useful case ("check the email on your order") without confirming anything.
 */
export type SignInRequestResult = Record<string, never>;

/**
 * Sends a sign-in link, if there is somebody to send it to.
 *
 * A blocked customer is treated as no match: they are not a person this shop
 * wants signing in, and telling them why at this endpoint would confirm the
 * account exists.
 */
export async function requestSignInLink(
  supabase: SupabaseClient,
  contact: Contact
): Promise<SignInRequestResult> {
  const customer = await findCustomer(supabase, contact);
  if (!customer || customer.is_blocked) return {};

  const token = newBearerToken();

  const { error } = await supabase.from('customer_auth_tokens').insert({
    customer_id: customer.id,
    token_hash: hashBearerToken(token),
  });

  if (error) {
    console.error(`Could not create a sign-in token for ${customer.id}:`, error.message);
    return {};
  }

  const { subject, html } = buildSignInLinkEmail({
    customerName: customer.full_name,
    // The page, not the API: clicking is a GET, and an inbox that prefetches
    // links would otherwise spend the token before the customer touched it.
    signInUrl: absoluteUrl(`/account/verify?token=${encodeURIComponent(token)}`),
  });

  const outcome = await sendOrderEmail(customer.email, subject, html);

  if (!outcome.success) {
    console.error(`Sign-in link email failed for ${customer.id}: ${outcome.reason}`);
    // Still reported as sent. The customer cannot fix our mail server, and the
    // alternative leaks whether the address exists.
    return {};
  }

  return {};
}

export type RedeemFailure = 'invalid' | 'expired';

export type RedeemResult =
  | { ok: true; sessionToken: string; customer: SignedInCustomer }
  | { ok: false; reason: RedeemFailure };

/**
 * Exchanges a link token for a session.
 *
 * The claim is a conditional UPDATE returning what it changed, so two clicks
 * racing cannot both succeed: whichever commits second updates nothing.
 */
export async function redeemSignInLink(
  supabase: SupabaseClient,
  token: string | null | undefined
): Promise<RedeemResult> {
  if (!isBearerTokenShape(token)) return { ok: false, reason: 'invalid' };

  const now = new Date().toISOString();

  const { data: claimed, error } = await supabase
    .from('customer_auth_tokens')
    .update({ used_at: now })
    .eq('token_hash', hashBearerToken(token as string))
    .is('used_at', null)
    .select('customer_id, expires_at');

  if (error) {
    console.error('Sign-in redemption failed:', error.message);
    return { ok: false, reason: 'invalid' };
  }

  const row = (claimed ?? [])[0] as { customer_id: string; expires_at: string } | undefined;
  if (!row) return { ok: false, reason: 'invalid' };

  // Claimed but stale. It is now spent either way, which is the right outcome:
  // an expired link should not become usable by waiting.
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  const { data: customer } = await supabase
    .from('customers')
    .select(CUSTOMER_COLUMNS)
    .eq('id', row.customer_id)
    .maybeSingle();

  const typed = customer as unknown as CustomerRow | null;
  if (!typed || typed.is_blocked) return { ok: false, reason: 'invalid' };

  const sessionToken = newBearerToken();

  const { error: sessionError } = await supabase.from('customer_sessions').insert({
    customer_id: typed.id,
    token_hash: hashBearerToken(sessionToken),
  });

  if (sessionError) {
    console.error(`Could not open a session for ${typed.id}:`, sessionError.message);
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true, sessionToken, customer: toCustomer(typed) };
}

/** The customer behind a session cookie, or null. Every account route calls
 *  this; nothing else decides whether a request is signed in. */
export async function readSession(
  supabase: SupabaseClient,
  token: string | null | undefined
): Promise<SignedInCustomer | null> {
  if (!isBearerTokenShape(token)) return null;

  const { data, error } = await supabase
    .from('customer_sessions')
    .select(`expires_at, customers ( ${CUSTOMER_COLUMNS} )`)
    .eq('token_hash', hashBearerToken(token as string))
    .maybeSingle();

  if (error) {
    console.error('Session read failed:', error.message);
    return null;
  }

  const row = data as unknown as { expires_at: string; customers: CustomerRow | null } | null;
  if (!row?.customers) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  if (row.customers.is_blocked) return null;

  return toCustomer(row.customers);
}

/** Signs this one device out. Deleting the row is what makes the cookie inert
 *  immediately, which a self-contained token could not offer. */
export async function endSession(
  supabase: SupabaseClient,
  token: string | null | undefined
): Promise<void> {
  if (!isBearerTokenShape(token)) return;

  const { error } = await supabase
    .from('customer_sessions')
    .delete()
    .eq('token_hash', hashBearerToken(token as string));

  if (error) console.error('Sign-out failed:', error.message);
}
