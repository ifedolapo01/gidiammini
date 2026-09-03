/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/reviews/page.tsx — the review moderation queue.
//
// Reviews arrive unpublished and the storefront cannot see them, so this page
// is the gate between a customer writing something and a stranger reading it.
// It opens on "Awaiting review" for that reason: anything else as the default
// tab makes the queue something you have to remember to check.
//
// The list, its states and its paging are the shared moderation surface — see
// useModerationQueue, which also drives /admin/questions. What is specific to
// reviews is the card and the wording.
'use client';

import { useState } from 'react';
import ModerationStatusTabs from '@/app/admin/components/ModerationStatusTabs';
import ModerationPanel from '@/app/admin/components/ModerationPanel';
import {
  useModerationQueue,
  type ModerationFilter,
} from '@/app/admin/hooks/useModerationQueue';
import type { AdminReview } from '@/lib/commerce/reviews';
import type { ModerationInput } from '@/lib/commerce/review-moderation';
import ReviewModerationCard from './components/ReviewModerationCard';

const TAB_LABELS: Record<ModerationFilter, string> = {
  pending: 'Awaiting review',
  published: 'Published',
  rejected: 'Rejected',
  all: 'All',
};

const EMPTY_MESSAGE: Record<ModerationFilter, string> = {
  pending: 'Nothing waiting. A new review appears here as soon as a customer writes one.',
  published: 'Nothing published yet. Publish a review and it appears on its product page.',
  rejected: 'No rejected reviews.',
  all: 'No reviews yet. They are invited automatically once an order is delivered.',
};

export default function AdminReviewsPage() {
  const [filter, setFilter] = useState<ModerationFilter>('pending');
  const queue = useModerationQueue<AdminReview, ModerationInput>('reviews', filter);

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <header>
        <h1 className="text-body-lg font-bold text-text-primary sm:text-h5 md:text-h4">Reviews</h1>
        <p className="mt-1 text-caption-md text-text-secondary sm:text-body-sm">
          Every review is written by a customer whose order was delivered, and none
          of them is visible to shoppers until you publish it.
        </p>
      </header>

      <ModerationStatusTabs
        value={filter}
        onChange={setFilter}
        counts={queue.counts}
        total={queue.total}
        labels={TAB_LABELS}
      />

      <ModerationPanel
        loading={queue.loading}
        error={queue.error}
        onRetry={queue.reload}
        empty={queue.items.length === 0}
        emptyMessage={EMPTY_MESSAGE[filter]}
        loadingMessage="Loading reviews…"
        page={queue.page}
        pageCount={queue.pageCount}
        total={queue.total}
        onPageChange={queue.goToPage}
        noun="review"
      >
        {queue.items.map((review) => (
          <ReviewModerationCard
            key={review.id}
            review={review}
            saving={queue.saving === review.id}
            onModerate={(change, message) => queue.moderate(review.id, change, message)}
            onDelete={() => queue.remove(review.id, 'Review deleted, photos included.')}
          />
        ))}
      </ModerationPanel>
    </div>
  );
}
