/**
 * PAYMENTS — the Paystack API, and the two things this shop asks of it.
 *
 * Initialize a transaction, and verify one. Everything else the provider can
 * do is deliberately absent: this is the smallest surface that supports "pay
 * now" beside the existing transfer flow, and each function it does not have
 * is a way the integration cannot go wrong.
 *
 * THE SECRET KEY NEVER LEAVES THE SERVER
 *
 * There is no public key here and no client-side SDK. The browser is sent an
 * authorization URL and nothing else, so the amount, the email and the
 * reference are all fixed server-side — a customer cannot open dev tools and
 * pay a different number.
 *
 * NOT CONFIGURED IS A SUPPORTED STATE
 *
 * With no PAYSTACK_SECRET_KEY the option simply does not appear at checkout,
 * the same way SMS reports itself as unconfigured rather than pretending to
 * send. A shop that has not signed up yet keeps working exactly as it did.
 */
import 'server-only';
import { KOBO_PER_NAIRA, secretKey } from './paystack-signature';

// Re-exported so a route needs one import for the whole Paystack surface.
export { isPaystackConfigured, isValidWebhookSignature, KOBO_PER_NAIRA } from './paystack-signature';

const API = 'https://api.paystack.co';

export interface InitializedPayment {
  authorizationUrl: string;
  reference: string;
}

export interface VerifiedPayment {
  reference: string;
  /** 'success' is the only one that means paid. */
  status: string;
  /** In kobo, as the provider reports it. */
  amountKobo: number;
  channel: string | null;
  paidAt: string | null;
  currency: string;
}

async function call(path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    // Never cached: one of these is a payment attempt and the other is the
    // question "has this been paid".
    cache: 'no-store',
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.status) {
    throw new Error(body?.message || `Paystack ${path} failed with ${response.status}`);
  }

  return body.data;
}

/**
 * Opens a payment and returns where to send the customer.
 *
 * The reference is ours, not theirs, and carries the order number in front of
 * a random suffix — see the column comment in migration 003800 for why that
 * shape is load-bearing.
 */
export async function initializePayment(params: {
  reference: string;
  amountNaira: number;
  email: string;
  callbackUrl: string;
  orderNumber: string;
}): Promise<InitializedPayment> {
  const data = await call('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      reference: params.reference,
      amount: Math.round(params.amountNaira * KOBO_PER_NAIRA),
      email: params.email,
      callback_url: params.callbackUrl,
      currency: 'NGN',
      // Shown on the provider's receipt and in their dashboard, which is where
      // a reconciliation question actually gets answered.
      metadata: { order_number: params.orderNumber },
    }),
  });

  return { authorizationUrl: data.authorization_url, reference: data.reference };
}

/** Asks the provider what actually happened. The webhook says the same thing;
 *  this is what the customer's return journey uses, and what makes the flow
 *  work even if the webhook is late or lost. */
export async function verifyPayment(reference: string): Promise<VerifiedPayment> {
  const data = await call(`/transaction/verify/${encodeURIComponent(reference)}`);

  return {
    reference: data.reference,
    status: data.status,
    amountKobo: Number(data.amount ?? 0),
    channel: data.channel ?? null,
    paidAt: data.paid_at ?? data.paidAt ?? null,
    currency: data.currency ?? 'NGN',
  };
}
