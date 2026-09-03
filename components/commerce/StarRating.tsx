/**
 * COMMERCE layer — a rating, drawn.
 *
 * One component behind every star row on the site: the product card, the
 * review summary, each individual review, and the admin moderation queue. They
 * were never going to render the same otherwise, and a card claiming 4.5 next
 * to a summary claiming 5 is worse than no stars at all.
 *
 * Fractions are real. 4.6 draws four solid stars and a mostly-filled fifth,
 * because rounding to a whole star throws away the difference the shopper is
 * reading. It is done by clipping a filled row over an outlined one, which
 * needs no gradient, no SVG surgery and no per-star arithmetic.
 *
 * The stars themselves are decoration — aria-hidden. The accessible name is a
 * sentence ("Rated 4.6 out of 5 from 12 reviews") built by the same helper the
 * JSON-LD uses, so the two can never say different things.
 */
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRatingAverage, ratingAriaLabel } from '@/lib/commerce/rating-math';

const sizes = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
} as const;

const gaps = {
  sm: 'gap-px',
  md: 'gap-0.5',
  lg: 'gap-1',
} as const;

export type StarRatingSize = keyof typeof sizes;

interface StarRatingProps {
  /** 0–5. Anything outside is clamped by the shared formatter. */
  average: number;
  /** Shown after the stars as "(12)" when given. Also joins the aria-label. */
  count?: number;
  size?: StarRatingSize;
  /** Prints the number itself — "4.6" — before the count. */
  showValue?: boolean;
  className?: string;
}

const STARS = [0, 1, 2, 3, 4];

export default function StarRating({
  average,
  count,
  size = 'md',
  showValue = false,
  className,
}: StarRatingProps) {
  // Percent of the five-star row that is filled. One number, one clip.
  const filled = `${(Math.min(5, Math.max(0, average)) / 5) * 100}%`;

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        role="img"
        aria-label={ratingAriaLabel(average, count)}
        className={cn('relative inline-flex', gaps[size])}
      >
        {STARS.map((index) => (
          <Star key={index} aria-hidden="true" className={cn(sizes[size], 'text-border-strong')} />
        ))}

        {/* The filled row, clipped to the rating. Same markup, same gaps, so
            the two rows line up exactly whatever the size. */}
        <span
          aria-hidden="true"
          className={cn('absolute inset-y-0 left-0 inline-flex overflow-hidden', gaps[size])}
          style={{ width: filled }}
        >
          {STARS.map((index) => (
            <Star
              key={index}
              className={cn(sizes[size], 'shrink-0 fill-warning text-warning')}
            />
          ))}
        </span>
      </span>

      {showValue && (
        <span className="text-body-sm font-semibold text-text-primary">
          {formatRatingAverage(average)}
        </span>
      )}

      {count !== undefined && (
        <span className="text-caption-md text-text-secondary">({count})</span>
      )}
    </span>
  );
}
