/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// Where the payment provider sends the customer back to.
//
// It verifies rather than believing the redirect. Anybody can open this URL
// with any reference, so the page asks Paystack directly what happened and
// renders that — the query string is a pointer, never evidence.
//
// The webhook does the same work independently. Both are idempotent and
// either can arrive first: this exists so the customer sees the outcome
// immediately instead of waiting on a server-to-server call they cannot see.
import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { isPaystackConfigured, verifyPayment } from '@/lib/payments/paystack';
import { paymentReferenceFrom } from '@/lib/payments/callback-params';
import {
  finalizePayment,
  readPaymentState,
  type FinalizeOutcome,
} from '@/lib/commerce/payment-finalize';
import { ClearCartOnPaid } from './components/ClearCartOnPaid';

export const metadata: Metadata = {
  title: 'Payment',
  robots: { index: false, follow: false },
};

/** The reference is in the URL and the answer depends on a live API call. */
export const dynamic = 'force-dynamic';

interface PaidPageProps {
  /** Repeated parameters arrive as arrays — see callback-params.ts. */
  searchParams: Promise<{ reference?: string | string[]; trxref?: string | string[] }>;
}

/**
 * Our record first, the provider second.
 *
 * The webhook is authoritative and often lands before the customer's browser
 * does, so the common case is answered without an API call at all. It also
 * means a provider that is slow, down or rate-limiting us cannot make this
 * page tell somebody whose card was charged that we have not seen their
 * payment — which is exactly what it did when a malformed reference reached
 * verify.
 */
async function resolve(reference: string | null): Promise<FinalizeOutcome> {
  if (!reference) return { status: 'not_paid' };

  // Typed loosely until `npm run db:types` reruns against a database that has
  // migration 003800.
  const supabase: SupabaseClient = createAdminClient();

  const known = await readPaymentState(supabase, reference);
  if (known) return known;

  if (!isPaystackConfigured()) return { status: 'not_paid' };

  try {
    return await finalizePayment(supabase, await verifyPayment(reference));
  } catch (error) {
    console.error(`Verifying ${reference} on return failed:`, error);
    // One more look at our own record: the webhook may have landed while the
    // provider call was failing.
    return (await readPaymentState(supabase, reference)) ?? { status: 'not_paid' };
  }
}

export default async function PaidPage({ searchParams }: PaidPageProps) {
  const outcome = await resolve(paymentReferenceFrom(await searchParams));

  const paid = outcome.status === 'confirmed' || outcome.status === 'already_paid';

  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="container mx-auto max-w-lg px-4 py-12 md:py-16">
        <div className="rounded-surface border border-border bg-surface p-6 text-center md:p-10">
          {paid ? (
            <>
              {/* The cart is only emptied once the money is confirmed. A failed
                  payment that had already cleared it would leave the customer
                  with nothing to retry. */}
              <ClearCartOnPaid />
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden="true" />
              <h1 className="mt-3 text-h5 font-bold text-text-primary">Payment received</h1>
              <p className="mt-2 text-body-md text-text-secondary">
                Order <strong>#{outcome.orderNumber}</strong> is confirmed. We have emailed
                you the details, and we will let you know as soon as it ships.
              </p>
            </>
          ) : outcome.status === 'amount_mismatch' ? (
            <>
              <XCircle className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
              <h1 className="mt-3 text-h5 font-bold text-text-primary">Something is off</h1>
              <p className="mt-2 text-body-md text-text-secondary">
                The amount paid does not match order <strong>#{outcome.orderNumber}</strong>.
                Nothing has been confirmed and a person is looking at it — please contact us
                and we will sort it out today.
              </p>
            </>
          ) : (
            <>
              <Clock className="mx-auto h-10 w-10 text-warning" aria-hidden="true" />
              <h1 className="mt-3 text-h5 font-bold text-text-primary">
                We have not seen that payment yet
              </h1>
              <p className="mt-2 text-body-md text-text-secondary">
                It may have been cancelled, or it may still be settling — refresh in a
                moment to check. Your cart is untouched, so nothing is lost either way,
                and you can pay by bank transfer instead.
              </p>
              <p className="mt-2 text-caption-md text-text-muted">
                If your bank has already debited you, do not pay again — contact us with
                your order number and we will confirm it by hand.
              </p>
            </>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href={paid ? '/track-order' : '/checkout'}
              className="rounded-control bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              {paid ? 'Track your order' : 'Back to checkout'}
            </Link>
            <Link
              href="/products"
              className="rounded-control border border-border-strong px-5 py-3 font-medium text-text-primary hover:bg-surface-hover"
            >
              Keep shopping
            </Link>
          </div>

          {paid && (
            <p className="mt-4 text-caption-md text-text-secondary">
              Signed in?{' '}
              <Link href="/account" className="text-primary underline-offset-4 hover:underline">
                This order is on your account
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
