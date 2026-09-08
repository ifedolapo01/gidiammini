/**
 * STOREFRONT layer — the fit signal that comes from buyers, not the admin's
 * own claim. FitNote is that claim; this is the outcome. Both can be shown at
 * once and can disagree: an admin's "true to size" and forty reviewers saying
 * "runs small" is exactly the disagreement a shopper should see, not one
 * quietly overwriting the other.
 *
 * Silent below the confidence threshold in dominantFitSignal (rating-math.ts)
 * — a couple of reviews split between two answers is not an opinion worth
 * printing, and "true to size" needs no warning banner of its own.
 */
import { AlertTriangle } from 'lucide-react';
import { dominantFitSignal, type ReviewStats } from '@/lib/commerce/rating-math';
import { fitLabel } from '@/lib/commerce/size-guide';

interface CustomerFitSignalProps {
  reviewStats: ReviewStats;
}

const SIZING_ADVICE = {
  runs_small: 'consider sizing up',
  runs_large: 'consider sizing down',
} as const;

export default function CustomerFitSignal({ reviewStats }: CustomerFitSignalProps) {
  const signal = dominantFitSignal(reviewStats);
  if (!signal || signal.rating === 'true_to_size') return null;

  return (
    <p className="mt-2 flex items-start gap-1.5 text-body-sm text-warning">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Most buyers say this <span className="font-semibold">{fitLabel(signal.rating).toLowerCase()}</span> —{' '}
        {SIZING_ADVICE[signal.rating]}.
      </span>
    </p>
  );
}
