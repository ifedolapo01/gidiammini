/**
 * STOREFRONT layer — the reviews section of a product page.
 *
 * A server component, and that is the whole design. Reviews are the only
 * substantial text most of these products will ever have, so they belong in
 * the HTML the response carries: it is what a crawler indexes, what a
 * WhatsApp preview can quote, and what a shopper on a slow connection sees
 * before any JavaScript has run. A client-side fetch would deliver stars and
 * an empty box.
 *
 * Rendered as a prop from the page (a server component passed into the client
 * ProductDetailView) so it can sit in the right place in the layout — after
 * the buying decision, before the recommendation rails — without the section
 * itself becoming client code. The page loads the data, because it needs the
 * same aggregate for the product's structured data.
 */
import type { ProductReviewsData } from '@/lib/commerce/review-query';
import ReviewSummary from './ReviewSummary';
import ReviewCard from './ReviewCard';

interface ProductReviewsProps {
  /** Loaded by the page, which also needs the aggregate for the JSON-LD and
   *  the star line under the product name. One read, three uses. */
  data: ProductReviewsData;
  productName: string;
}

export default function ProductReviews({ data, productName }: ProductReviewsProps) {
  const { reviews, stats } = data;

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="mt-12 scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="reviews-heading" className="text-h5 font-bold text-text-primary">
          Reviews
        </h2>
        {stats.review_count > 0 && (
          <p className="text-body-sm text-text-secondary">
            Showing the {reviews.length === 1 ? 'only review' : `${reviews.length} most recent`}
            {stats.review_count > reviews.length ? ` of ${stats.review_count}` : ''}
          </p>
        )}
      </div>

      {stats.review_count === 0 ? (
        /* An empty state that says something true rather than nothing.
           "No reviews yet" alone reads as a fault; explaining who is allowed
           to write one turns the absence into the same trust signal the
           reviews themselves are for. */
        <div className="rounded-surface border border-dashed border-border bg-surface p-6 text-center">
          <p className="text-body-md font-medium text-text-primary">
            No reviews for this one yet
          </p>
          <p className="mx-auto mt-2 max-w-prose text-body-sm text-text-secondary">
            We only ask for a review once an order has actually been delivered,
            and only the person who bought it can leave one — so this space stays
            empty until a real customer fills it. If that is you, check your email
            after your parcel arrives.
          </p>
        </div>
      ) : (
        <>
          <ReviewSummary stats={stats} />

          <div className="mt-2">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} productName={productName} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
