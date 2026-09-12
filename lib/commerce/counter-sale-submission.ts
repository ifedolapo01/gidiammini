/**
 * COMMERCE layer — validates a counter-sale submission.
 *
 * The online-checkout equivalent, order-submission.ts, requires a name, an
 * email and a phone number and checks the buyer against the block list. None
 * of that applies here: a counter sale is paid in hand before the order ever
 * exists, so there is no delivery to no-show on and no chargeback to abuse —
 * the walk-in identity fields exist only so the shop can reach the customer
 * again if it wants to, never as a gate on the sale.
 */
import { isValidIdempotencyKey } from './order-number';
import { isValidEmail } from '@/lib/validation';

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export interface ValidatedCounterSale {
  idempotencyKey: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: 'cash' | 'pos';
}

export type ValidateCounterSaleResult =
  | { ok: true; validated: ValidatedCounterSale }
  | { ok: false; error: string; status: number };

interface RawCounterSaleFields {
  idempotency_key?: unknown;
  customer_name?: unknown;
  customer_email?: unknown;
  customer_phone?: unknown;
  payment_method?: unknown;
}

export function validateCounterSaleSubmission(
  submission: RawCounterSaleFields
): ValidateCounterSaleResult {
  if (!isValidIdempotencyKey(submission.idempotency_key)) {
    return {
      ok: false,
      status: 400,
      error: 'This sale is missing its reference. Please reload and try again.',
    };
  }

  if (submission.payment_method !== 'cash' && submission.payment_method !== 'pos') {
    return { ok: false, status: 400, error: 'Choose how this sale was paid for.' };
  }

  const customerEmail = trimmed(submission.customer_email).toLowerCase();

  // Optional, unlike checkout — but a value that was typed in has to actually
  // be an email, or the identity link it is meant to create would be useless.
  if (customerEmail && !isValidEmail(customerEmail)) {
    return { ok: false, status: 400, error: 'Please enter a valid email address, or leave it blank.' };
  }

  return {
    ok: true,
    validated: {
      idempotencyKey: (submission.idempotency_key as string).trim().toLowerCase(),
      customerName: trimmed(submission.customer_name),
      customerEmail,
      customerPhone: trimmed(submission.customer_phone),
      paymentMethod: submission.payment_method,
    },
  };
}
