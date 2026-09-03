/**
 * COMMERCE layer (server only) — reading the customers table for sign-in.
 *
 * Split from customer-auth.ts, which is now purely the credential flow. This
 * file answers one question — "which customer, if any, does this contact
 * identify" — and it is worth its own module because the answer has a rule
 * that is easy to get wrong:
 *
 * A phone number that matches more than one customer identifies nobody. The
 * customers table documents one number shared by two different email addresses
 * (see migration 20251101002500), so picking one would hand that person the
 * other's order history. "Several" is treated exactly like "none".
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Contact } from './customer-account';

export interface SignedInCustomer {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
}

export interface CustomerRow {
  id: string;
  email: string;
  full_name: string | null;
  phone_raw: string | null;
  phone_e164: string | null;
  is_blocked: boolean;
}

export const CUSTOMER_COLUMNS = 'id, email, full_name, phone_raw, phone_e164, is_blocked';

export function toCustomer(row: CustomerRow): SignedInCustomer {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone_raw ?? row.phone_e164,
  };
}

/**
 * The customer this contact identifies, or null when that cannot be answered
 * safely. See rule 3 for why "several" is the same as "none".
 */
export async function findCustomer(
  supabase: SupabaseClient,
  contact: Contact
): Promise<CustomerRow | null> {
  const query =
    contact.kind === 'email'
      ? supabase.from('customers').select(CUSTOMER_COLUMNS).eq('email', contact.email)
      : supabase.from('customers').select(CUSTOMER_COLUMNS).eq('phone_e164', contact.msisdn);

  // Two rows are fetched even though one is wanted: the count is the answer.
  const { data, error } = await query.limit(2);

  if (error) {
    console.error('Customer lookup failed:', error.message);
    return null;
  }

  const rows = (data ?? []) as unknown as CustomerRow[];

  if (rows.length !== 1) {
    if (rows.length > 1) {
      console.warn(
        `Sign-in by phone matched ${rows.length} customers — sending nothing, as there is no safe way to choose.`
      );
    }
    return null;
  }

  return rows[0];
}
