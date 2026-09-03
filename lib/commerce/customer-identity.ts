/**
 * COMMERCE layer — resolves the buyer behind an order to a durable identity.
 *
 * An order carries `customer_name`/`customer_email`/`customer_phone` as an
 * immutable snapshot of what was typed at that checkout. Those strings answer
 * "where did this parcel go"; they cannot answer "is this the same person who
 * ordered in March". The `customers` table does, keyed on the normalised email.
 *
 * Two rules this file exists to enforce:
 *
 *   1. Identity is keyed on email alone, never email+phone. Live data already
 *      has one phone number shared by two different email addresses, so a key
 *      spanning both would either split one buyer across rows or reject the
 *      second buyer outright.
 *   2. Bookkeeping never costs a sale. Every failure here is logged and
 *      swallowed: the order proceeds with `customer_id` NULL rather than the
 *      customer seeing an error because a profile row would not save.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalisePhone } from '@/lib/notifications/phone';
import { isValidEmail } from '@/lib/validation';

export interface CustomerIdentityInput {
  email: string;
  name?: string;
  phone?: string;
}

/** The canonical form of an email for identity purposes. Mirrors the CHECK
 * constraint on customers.email, so a value built here always satisfies it. */
export function normaliseEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * Finds or creates the customer for this email and returns their id, or null
 * when no identity could be established.
 *
 * The upsert refreshes `full_name`/`phone_*` to the latest values given, so a
 * buyer who has changed number is reachable on the new one — while every past
 * order keeps the number it shipped against.
 */
export async function resolveCustomerId(
  supabase: SupabaseClient,
  input: CustomerIdentityInput
): Promise<string | null> {
  const email = normaliseEmail(input.email);

  // No email means no identity. Checkout requires one, so this is only
  // reachable from an unusual path — worth a line in the log, not an error.
  if (!email || !isValidEmail(email)) {
    console.warn('Customer identity skipped: no usable email on the order.');
    return null;
  }

  const phoneRaw = typeof input.phone === 'string' ? input.phone.trim() : '';
  const normalised = normalisePhone(phoneRaw);
  const fullName = typeof input.name === 'string' ? input.name.trim() : '';

  const row = {
    email,
    full_name: fullName || null,
    phone_raw: phoneRaw || null,
    phone_e164: normalised.ok ? normalised.msisdn : null,
  };

  const { data, error } = await supabase
    .from('customers')
    .upsert(row, { onConflict: 'email' })
    .select('id')
    .single();

  if (error) {
    // Includes the case where the migration has not been applied yet. The
    // order still goes through; the link is simply missing until a backfill.
    console.error(`Could not resolve a customer for ${email}: ${error.message}`);
    return null;
  }

  return data?.id ?? null;
}

/** Whether this buyer has been blocked from ordering. Read separately from the
 * upsert so a blocked customer is never silently un-blocked by a refresh. */
export async function isCustomerBlocked(
  supabase: SupabaseClient,
  email: string
): Promise<{ blocked: boolean; reason?: string }> {
  const normalised = normaliseEmail(email);
  if (!normalised) return { blocked: false };

  const { data, error } = await supabase
    .from('customers')
    .select('is_blocked, blocked_reason')
    .eq('email', normalised)
    .maybeSingle();

  if (error || !data) {
    // Fail open: an unreachable customers table must not stop a genuine order.
    if (error) console.error(`Block check failed for ${normalised}: ${error.message}`);
    return { blocked: false };
  }

  return data.is_blocked === true
    ? { blocked: true, reason: data.blocked_reason ?? undefined }
    : { blocked: false };
}
