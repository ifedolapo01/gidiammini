/**
 * STOREFRONT layer — the block at the top of the reviews section.
 *
 * Three claims, in the order they are worth reading: the average, how many
 * people it is an average of, and how those people actually split. The
 * distribution matters because "4.6 from 30" and "4.6 from 3" are different
 * facts, and because a shopper who wants to know what the unhappy people said
 * looks for the one-star bar first.
 *
 * The verified line is the point of the whole feature on a transfer-first
 * checkout: every one of these was written by somebody whose order this shop
 * actually delivered.
 */
import { ShieldCheck } from 'lucide-react';
import StarRating from '@/components/commerce/StarRating';
import { formatRatingAverage, ratingDistribution, type ReviewStats } from '@/lib/commerce/rating-math';

interface ReviewSummaryProps {
  stats: ReviewStats;
}

export default function ReviewSummary({ stats }: ReviewSummaryProps) {
  const bars = ratingDistribution(stats);

  return (
    <div className="bg-surface border border-border rounded-surface p-4 md:p-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        {/* The headline number. Large, because it is the one thing most
            shoppers read before scrolling past. */}
        <div className="shrink-0 text-center sm:text-left">
          <p className="text-h3 font-bold leading-none text-text-primary">
            {formatRatingAverage(stats.rating_average)}
            <span className="text-body-md font-normal text-text-secondary"> / 5</span>
          </p>
          <StarRating average={stats.rating_average} size="lg" className="mt-2" />
          <p className="mt-2 text-body-sm text-text-secondary">
            {stats.review_count} {stats.review_count === 1 ? 'review' : 'reviews'}
          </p>
        </div>

        {/* The split. A table would be more semantic but reads worse; each row
            names its own rating for a screen reader instead. */}
        <ul className="flex-1 space-y-1.5">
          {bars.map((bar) => (
            <li key={bar.rating} className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-caption-md text-text-secondary">
                {bar.rating} star
              </span>
              <span
                className="h-2 flex-1 overflow-hidden rounded-full bg-background-tertiary"
                role="img"
                aria-label={`${bar.count} of ${stats.review_count} rated ${bar.rating} out of 5`}
              >
                <span
                  className="block h-full rounded-full bg-warning"
                  style={{ width: `${bar.percent}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-caption-md text-text-secondary">
                {bar.count}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {stats.verified_count > 0 && (
        <p className="mt-4 flex items-start gap-2 border-t border-divider pt-4 text-body-sm text-text-secondary">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <span>
            <strong className="font-medium text-text-primary">
              {stats.verified_count} verified {stats.verified_count === 1 ? 'purchase' : 'purchases'}
            </strong>{' '}
            — we only invite a review after an order has been delivered, so nobody
            can leave one for something they did not buy.
          </span>
        </p>
      )}
    </div>
  );
}
