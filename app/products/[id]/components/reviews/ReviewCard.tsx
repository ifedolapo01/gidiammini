/**
 * STOREFRONT layer — one review.
 *
 * Server-rendered, like the section around it: this text is the long-tail
 * content the product's own two-line description cannot provide, and content
 * that arrives after hydration is content a crawler may never see.
 *
 * The photo thumbnails are plain links to the full-size image rather than a
 * lightbox. It costs no JavaScript, works with the keyboard for free, and a
 * shopper who wants to see the fabric close up gets the actual file.
 */
import { ShieldCheck } from 'lucide-react';
import ProductImage from '@/components/commerce/ProductImage';
import StarRating from '@/components/commerce/StarRating';
import { Badge } from '@/components/ui';
import { formatDateOnly } from '@/lib/commerce/format-date';
import type { PublicReview } from '@/lib/commerce/reviews';

interface ReviewCardProps {
  review: PublicReview;
  /** Names the product, for the review's own accessible heading. */
  productName: string;
}

export default function ReviewCard({ review, productName }: ReviewCardProps) {
  return (
    <article className="border-b border-divider py-5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StarRating average={review.rating} size="sm" />
        {review.title && (
          <h3 className="text-body-md font-semibold text-text-primary">{review.title}</h3>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption-md text-text-secondary">
        <span className="font-medium text-text-primary">{review.author_name}</span>
        <span aria-hidden="true">·</span>
        {/* dateTime carries the machine-readable value; the text is for people. */}
        <time dateTime={review.created_at}>{formatDateOnly(review.created_at)}</time>
        {review.variant_label && (
          <>
            <span aria-hidden="true">·</span>
            <span>Bought {review.variant_label}</span>
          </>
        )}
        {review.is_verified_purchase && (
          <Badge tone="success" variant="subtle">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            Verified purchase
          </Badge>
        )}
      </div>

      {review.body && (
        <p className="mt-3 whitespace-pre-line text-body-md text-text-secondary">{review.body}</p>
      )}

      {review.photos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {review.photos.map((photo, index) => (
            <li key={photo}>
              <a
                href={photo}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              >
                <ProductImage
                  src={photo}
                  alt={`Customer photo ${index + 1} of ${productName}, from ${review.author_name}'s review`}
                  sizes="96px"
                  className="h-24 w-24 rounded-control"
                />
              </a>
            </li>
          ))}
        </ul>
      )}

      {review.admin_response && (
        <div className="mt-3 rounded-control border-l-2 border-primary bg-background-secondary p-3">
          <p className="text-caption-md font-semibold text-text-primary">Reply from GidiamMini</p>
          <p className="mt-1 whitespace-pre-line text-body-sm text-text-secondary">
            {review.admin_response}
          </p>
        </div>
      )}
    </article>
  );
}
