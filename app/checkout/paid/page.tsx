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
import { finalizePayment, type FinalizeOutcome } from '@/lib/commerce/payment-finalize';
import { ClearCartOnPaid } from './components/ClearCartOnPaid';

export const metadata: Metadata = {
  title: 'Payment',
  robots: { index: false, follow: false },
};

/** The reference is in the URL and the answer depends on a live API call. */
export const dynamic = 'force-dynamic';

interface PaidPageProps {
  searchParams: Promise<{ reference?: string }>;
}

async function resolve(reference: string): Promise<FinalizeOutcome> {
  if (!reference || !isPaystackConfigured()) return { status: 'not_paid' };

  try {
    const payment = await verifyPayment(reference);
    // Typed loosely until `npm run db:types` reruns against a database that
    // has migration 003800.
    const supabase: SupabaseClient = createAdminClient();
    return await finalizePayment(supabase, payment);
  } catch (error) {
    console.error(`Verifying ${reference} on return failed:`, error);
    return { status: 'not_paid' };
  }
}

export default async function PaidPage({ searchParams }: PaidPageProps) {
  const { reference } = await searchParams;
  const outcome = await resolve(reference ?? '');

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
                We have not seen that payment
              </h1>
              <p className="mt-2 text-body-md text-text-secondary">
                It may have been cancelled, or it may still be going through. Your cart is
                untouched — try again, or pay by bank transfer instead.
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
