/**
 * COMMERCE layer (server only) — recording what the provider said.
 *
 * Best-effort, and that is the whole design constraint: this is a log, and a
 * log must never be the reason a payment is not confirmed. Every failure here
 * is swallowed after being written to the server log — the money has already
 * arrived and the order has already moved, and a webhook that answers 500
 * because its audit row would not insert is a webhook the provider retries
 * forever.
 *
 * Only signature-verified messages reach this. See the migration header for
 * why rejected attempts are counted rather than stored.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FinalizeOutcome } from './payment-finalize';

/** A duplicate delivery of an event already recorded. Normal, not an error. */
const UNIQUE_VIOLATION = '23505';

export interface PaymentEventInput {
  event: string;
  reference: string;
  transactionId: string | null;
  amountKobo: number | null;
  /** The message as received, parsed. Stored verbatim. */
  payload: unknown;
  /** What finalizePayment decided, or 'error' when it threw. */
  outcome: FinalizeOutcome['status'] | 'error';
  orderId?: string | null;
}

export async function recordPaymentEvent(
  supabase: SupabaseClient,
  input: PaymentEventInput
): Promise<void> {
  try {
    const { error } = await supabase.from('payment_events').insert({
      provider: 'paystack',
      event: input.event,
      reference: input.reference,
      transaction_id: input.transactionId,
      order_id: input.orderId ?? null,
      amount_kobo: input.amountKobo,
      outcome: input.outcome,
      payload: input.payload,
    });

    // The provider resends until it gets a 200, so the same event arriving
    // twice is the system working. The partial unique index collapses it.
    if (error && error.code !== UNIQUE_VIOLATION) {
      console.error(`Could not record payment event for ${input.reference}:`, error.message);
    }
  } catch (cause) {
    console.error(`Recording the payment event for ${input.reference} threw:`, cause);
  }
}
