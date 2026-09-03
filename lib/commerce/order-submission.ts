/**
 * COMMERCE layer — validates and normalises a checkout submission into the
 * identity fields an order needs.
 *
 * Split out of create-order.ts so that file reads as orchestration: check the
 * submission, price it, claim stock, write it, notify. The API layer's zod
 * schema (lib/api/schemas/public-orders.ts) already guarantees shape and
 * length; this owns the business rules on top of it — that the idempotency key
 * is a real UUID, that the email can actually receive a receipt, and that the
 * buyer is not barred from ordering.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidIdempotencyKey } from './order-number';
import { isCustomerBlocked } from './customer-identity';
import { isValidEmail } from '@/lib/validation';

export function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** The identity fields, normalised, once every rule has passed. */
export interface ValidatedSubmission {
  idempotencyKey: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export type ValidateSubmissionResult =
  | { ok: true; validated: ValidatedSubmission }
  | { ok: false; error: string; status: number };

interface RawIdentityFields {
  idempotency_key?: unknown;
  customer_name?: unknown;
  customer_email?: unknown;
  customer_phone?: unknown;
}

export async function validateOrderSubmission(
  supabase: SupabaseClient,
  submission: RawIdentityFields
): Promise<ValidateSubmissionResult> {
  const customerName = trimmed(submission.customer_name);
  const customerEmail = trimmed(submission.customer_email).toLowerCase();
  const customerPhone = trimmed(submission.customer_phone);

  if (!isValidIdempotencyKey(submission.idempotency_key)) {
    return {
      ok: false,
      status: 400,
      error: 'This checkout session is missing its reference. Please reload and try again.',
    };
  }

  if (!customerName || !customerEmail || !customerPhone) {
    return { ok: false, status: 400, error: 'Your name, email and phone are all required.' };
  }

  if (!isValidEmail(customerEmail)) {
    return { ok: false, status: 400, error: 'Please enter a valid email address.' };
  }

  // A buyer an admin has barred — repeated no-shows on delivery, chargeback
  // abuse. Checked before any pricing or stock work so a blocked order never
  // holds inventory. Fails open if the lookup itself errors, because an
  // unreachable customers table must not stop a genuine sale.
  const blocked = await isCustomerBlocked(supabase, customerEmail);
  if (blocked.blocked) {
    console.warn(
      `Refused order for blocked customer ${customerEmail}: ${blocked.reason ?? 'no reason recorded'}`
    );
    return {
      ok: false,
      status: 403,
      error: 'We are not able to accept this order. Please contact us so we can help.',
    };
  }

  return {
    ok: true,
    validated: {
      // Lower-cased so the same attempt retried with different casing is still
      // recognised as a replay by the unique index.
      idempotencyKey: (submission.idempotency_key as string).trim().toLowerCase(),
      customerName,
      customerEmail,
      customerPhone,
    },
  };
}
