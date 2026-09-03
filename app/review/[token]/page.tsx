/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// The page an invite email links to: rate what you bought.
//
// The token in the URL is the credential — there is no login, because asking
// someone to make an account before they can say the sleepsuit was nice is how
// you get no reviews. It is resolved server-side before anything renders, so
// an invalid or expired link produces an explanation rather than a form that
// fails on submit.
//
// noindex, and that is not optional: the URL contains a bearer token. A
// crawler that indexed one would publish somebody's ability to review their
// own order. The email's link is the only route here.
import type { Metadata } from 'next';
import Link from 'next/link';
import { PackageCheck } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { resolveReviewClaim } from '@/lib/commerce/review-claim';
import ReviewItemForm from './components/ReviewItemForm';

export const metadata: Metadata = {
  title: 'Leave a review',
  robots: { index: false, follow: false },
};

/**
 * Never cached, never prerendered. The page's whole content depends on a
 * token, and a cached render would be one customer's order shown to whoever
 * asked next.
 */
export const dynamic = 'force-dynamic';

interface ReviewPageProps {
  params: Promise<{ token: string }>;
}

/** The shell every state renders inside, so the copy is the only difference. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="container mx-auto max-w-3xl px-4 py-8 md:py-12">{children}</div>
    </div>
  );
}

function Explanation({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Shell>
      <div className="rounded-surface border border-border bg-surface p-6 text-center md:p-10">
        <h1 className="text-h5 font-bold text-text-primary">{heading}</h1>
        <p className="mx-auto mt-3 max-w-prose text-body-md text-text-secondary">{children}</p>
        <Link
          href="/products"
          className="mt-6 inline-flex items-center text-body-md font-medium text-primary underline-offset-4 hover:underline"
        >
          Browse the collection →
        </Link>
      </div>
    </Shell>
  );
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { token } = await params;

  const claim = await resolveReviewClaim(createAdminClient(), token);

  if (!claim.ok) {
    return claim.reason === 'expired' ? (
      <Explanation heading="That review link has expired">
        Review links last a few months, and this one has passed its date. If you
        still want to leave a review, get in touch and we will send you a fresh
        link.
      </Explanation>
    ) : (
      <Explanation heading="We could not open that review link">
        The link may have been copied incompletely, or it may belong to an order
        that no longer exists. The link in your delivery email is the one that
        works.
      </Explanation>
    );
  }

  const { orderNumber, customerName, items } = claim.claim;
  const outstanding = items.filter((item) => !item.reviewed).length;

  if (items.length === 0) {
    return (
      <Explanation heading="There is nothing left to review on this order">
        The items on it are no longer in our catalogue, so there is nowhere for a
        review to appear. Thank you for wanting to leave one.
      </Explanation>
    );
  }

  return (
    <Shell>
      <header className="mb-6">
        <p className="inline-flex items-center gap-2 text-caption-md font-medium uppercase tracking-wider text-text-secondary">
          <PackageCheck className="h-4 w-4 text-success" aria-hidden="true" />
          Order #{orderNumber}
        </p>
        <h1 className="mt-2 text-h4 font-bold text-text-primary md:text-h3">
          How was it, {customerName.split(' ')[0] || 'there'}?
        </h1>
        <p className="mt-2 max-w-prose text-body-md text-text-secondary">
          {outstanding === 0
            ? 'You have reviewed everything on this order — thank you. Nothing else to do here.'
            : `Rate ${outstanding === 1 ? 'the item' : `each of the ${outstanding} items`} below. The
               rating is the only part we need; everything else is optional. Most people
               are buying from us for the first time, and what you write is the only
               evidence they have that somebody did it before them.`}
        </p>
      </header>

      <ul className="space-y-4">
        {items.map((item) => (
          <ReviewItemForm
            key={item.productId}
            token={token}
            item={item}
            defaultAuthorName={customerName}
          />
        ))}
      </ul>
    </Shell>
  );
}
