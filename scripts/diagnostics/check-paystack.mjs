/**
 * What does Paystack say about one reference?
 *
 *   node scripts/diagnostics/check-paystack.mjs UT00100012-97dff18c
 *
 * Read-only: it calls the provider's verify endpoint and prints the answer.
 * Pair it with check-order.mjs — "Paystack says success, our order says
 * pending" localises the failure to the confirmation path (a callback that
 * went to the wrong domain, or a webhook that was never delivered) rather than
 * to the payment itself.
 *
 * Prints which key mode is configured, because verifying a live reference with
 * a test key returns "not found" and looks like a missing payment.
 */
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const reference = process.argv[2];
if (!reference) {
  console.error('Usage: node scripts/diagnostics/check-paystack.mjs <reference>');
  process.exit(1);
}

const key = process.env.PAYSTACK_SECRET_KEY?.trim();
if (!key) {
  console.error('PAYSTACK_SECRET_KEY is not set.');
  process.exit(1);
}

console.log(`key mode: ${key.startsWith('sk_test') ? 'TEST' : key.startsWith('sk_live') ? 'LIVE' : 'unknown'}`);

const response = await fetch(
  `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
  { headers: { Authorization: `Bearer ${key}` } }
);

const body = await response.json().catch(() => null);
const data = body?.data ?? {};

console.log(
  JSON.stringify(
    {
      http: response.status,
      message: body?.message,
      status: data.status,
      amount_kobo: data.amount,
      currency: data.currency,
      channel: data.channel,
      paid_at: data.paid_at,
      gateway_response: data.gateway_response,
    },
    null,
    2
  )
);
