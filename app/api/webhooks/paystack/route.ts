// app/api/webhooks/paystack/route.ts - the provider telling us money arrived.
//
// This is the authority on whether an order is paid. The customer's return
// journey verifies too, but they can close the tab, lose signal, or never come
// back — and the money still landed. The webhook is what makes the flow work
// anyway.
//
// Three rules:
//
//   1. The signature is checked against the RAW body. Parsing and
//      re-serialising the JSON changes the bytes and the HMAC stops matching,
//      which is why this reads request.text() and parses afterwards.
//   2. Nothing in the payload is trusted for the amount. finalizePayment
//      compares against the order's own total and refuses a mismatch.
//   3. It answers 200 to anything it has understood, including events it does
//      not act on. A provider that gets a non-200 retries — and retrying an
//      event we deliberately ignored is noise forever.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { isPaystackConfigured, isValidWebhookSignature } from '@/lib/payments/paystack';
import { finalizePayment } from '@/lib/commerce/payment-finalize';
import { recordPaymentEvent } from '@/lib/commerce/payment-events';

/** The only event this shop acts on. A refund or a dispute is a conversation,
 *  not a state transition, and inventing one automatically would be worse than
 *  a person handling it. */
const PAID = 'charge.success';

export async function POST(request: NextRequest) {
  if (!isPaystackConfigured()) {
    // Nothing is configured, so nothing can be verified. 503 rather than 200:
    // this is a state worth retrying into once the key is set.
    return NextResponse.json({ success: false }, { status: 503 });
  }

  const raw = await request.text();

  if (!isValidWebhookSignature(raw, request.headers.get('x-paystack-signature'))) {
    // Counted here and nowhere else. Storing rejected attempts would turn a
    // public endpoint into an unbounded write — see migration 003900.
    console.warn('Rejected a Paystack webhook with a bad signature.');
    return NextResponse.json({ success: false }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  if (event?.event !== PAID) {
    // Understood and ignored. See rule 3.
    return NextResponse.json({ success: true, ignored: event?.event ?? 'unknown' });
  }

  const data = event.data ?? {};

  // Typed loosely until `npm run db:types` reruns against a database that has
  // migrations 003800 and 003900.
  const supabase: SupabaseClient = createAdminClient();

  const reference = String(data.reference ?? '');
  const transactionId = data.id != null ? String(data.id) : null;
  const amountKobo = Number.isFinite(Number(data.amount)) ? Number(data.amount) : null;

  try {
    const outcome = await finalizePayment(supabase, {
      reference,
      status: String(data.status ?? ''),
      amountKobo: Number(data.amount ?? 0),
      channel: data.channel ?? null,
      paidAt: data.paid_at ?? null,
      currency: String(data.currency ?? 'NGN'),
    });

    console.log(`Paystack webhook for ${reference}: ${outcome.status}`);

    // After the decision, never able to change it — see payment-events.ts.
    await recordPaymentEvent(supabase, {
      event: PAID,
      reference,
      transactionId,
      amountKobo,
      payload: event,
      outcome: outcome.status,
      orderId: 'orderId' in outcome ? outcome.orderId : null,
    });

    return NextResponse.json({ success: true, outcome: outcome.status });
  } catch (error: any) {
    // A 500 asks the provider to retry, which is right: the signature was
    // valid, so this is our failure and the money is real. The row is what
    // makes that failure findable afterwards rather than a log line that
    // scrolls away.
    console.error('Paystack webhook handling failed:', error);

    await recordPaymentEvent(supabase, {
      event: PAID,
      reference,
      transactionId,
      amountKobo,
      payload: event,
      outcome: 'error',
    });

    return NextResponse.json({ success: false }, { status: 500 });
  }
}
