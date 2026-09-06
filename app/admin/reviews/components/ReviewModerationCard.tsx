/**
 * ADMIN layer — one review, and what can be done about it.
 *
 * A card rather than a table row, unlike the rest of the admin's lists. A
 * review is a paragraph, four photos and a decision; the columns that would
 * make it a table would each be one line high and the body would wrap to six.
 * The scannable part — product, stars, status — is the top line, so the queue
 * still reads at a glance.
 *
 * Publish is the only action styled as primary. It is the one that changes what
 * a stranger sees, and the honest default for most reviews.
 */
'use client';

import { ShieldCheck } from 'lucide-react';
import ProductImage from '@/components/commerce/ProductImage';
import StarRating from '@/components/commerce/StarRating';
import { Badge } from '@/components/ui';
import { formatDate } from '@/lib/commerce/format-date';
import { reviewPhotoUrl, reviewStatusLabel, type AdminReview } from '@/lib/commerce/reviews';
import ReviewModerationActions from './ReviewModerationActions';
// The route's own input type, so the card cannot invent a field the API would
// strip. Type-only, so nothing server-side is pulled into the bundle.
import type { ModerationInput } from '@/lib/commerce/review-moderation';

const STATUS_TONE = {
  pending: 'warning',
  published: 'success',
  rejected: 'destructive',
} as const;

interface ReviewModerationCardProps {
  review: AdminReview;
  saving: boolean;
  onModerate: (change: ModerationInput, successMessage: string) => void;
  onDelete: () => void;
}

export default function ReviewModerationCard({
  review,
  saving,
  onModerate,
  onDelete,
}: ReviewModerationCardProps) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const photos = review.photo_paths ?? [];

  return (
    <li className="border-b border-divider p-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ProductImage
            src={review.products?.main_image}
            alt=""
            sizes="48px"
            className="h-12 w-12 shrink-0 rounded-control"
          />
          <div className="min-w-0">
            <p className="truncate text-body-md font-semibold text-text-primary">
              {review.products?.name ?? 'Deleted product'}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption-md text-text-secondary">
              <StarRating average={review.rating} size="sm" />
              <span aria-hidden="true">·</span>
              <span>{formatDate(review.created_at)}</span>
              {review.orders?.order_number && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>#{review.orders.order_number}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {review.is_verified_purchase && (
            <Badge tone="success" variant="outline">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Verified
            </Badge>
          )}
          <Badge tone={STATUS_TONE[review.status]}>{reviewStatusLabel(review.status)}</Badge>
        </div>
      </div>

      <div className="mt-3 pl-0 sm:pl-15">
        {review.title && (
          <p className="text-body-md font-medium text-text-primary">{review.title}</p>
        )}
        {review.body ? (
          <p className="mt-1 whitespace-pre-line text-body-sm text-text-secondary">{review.body}</p>
        ) : (
          <p className="mt-1 text-body-sm italic text-text-muted">Rating only, no text.</p>
        )}

        {photos.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {photos.map((path, index) => (
              <li key={path}>
                {/* Opens the actual file: a moderator deciding about a photo
                    needs to see it at full size, not a 96px crop. */}
                <a
                  href={reviewPhotoUrl(path, base)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                >
                  <ProductImage
                    src={reviewPhotoUrl(path, base)}
                    alt={`Customer photo ${index + 1}`}
                    sizes="96px"
                    className="h-24 w-24 rounded-control"
                  />
                </a>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-2 text-caption-md text-text-secondary">
          {review.author_name} · {review.author_email}
        </p>

        <ReviewModerationActions
          review={review}
          photos={photos}
          saving={saving}
          onModerate={onModerate}
          onDelete={onDelete}
        />
      </div>
    </li>
  );
}
