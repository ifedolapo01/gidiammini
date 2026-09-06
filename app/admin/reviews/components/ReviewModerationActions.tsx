/**
 * ADMIN layer — the row of controls under one review in the moderation queue.
 *
 * Split from ReviewModerationCard when the confirmation dialogs pushed that
 * file past the file-size limit. The card renders the review; this renders
 * what can be done to it.
 *
 * The two dialogs here are deliberately different weights. Rejecting is a
 * status change and can be undone by publishing again — so it only asks at all
 * when photos are attached, because deleting those is not reversible. Deleting
 * the review is not reversible at all, and asks for the word to be typed.
 */
'use client';

import Link from 'next/link';
import { ExternalLink, Trash2, XCircle } from 'lucide-react';
import { Button, useConfirm } from '@/components/ui';
import type { AdminReview } from '@/lib/commerce/reviews';
import type { ModerationInput } from '@/lib/commerce/review-moderation';
import ReviewReplyForm from './ReviewReplyForm';

interface ReviewModerationActionsProps {
  review: AdminReview;
  /** Object paths of the review's photos — the count drives both dialogs. */
  photos: string[];
  saving: boolean;
  onModerate: (input: ModerationInput, successMessage: string) => void;
  onDelete: () => void;
}

export default function ReviewModerationActions({
  review,
  photos,
  saving,
  onModerate,
  onDelete,
}: ReviewModerationActionsProps) {
  const confirm = useConfirm();

  const photoLine = (verb: string) =>
    `${verb} ${photos.length} photo${photos.length === 1 ? '' : 's'}`;

  const handleReject = async () => {
    // Only asks when there are photos: those are the part that cannot be
    // walked back. The review's status can always be set to published again.
    if (photos.length > 0) {
      const confirmed = await confirm({
        title: 'Reject this review?',
        consequences: [
          `${photoLine('Deletes')} permanently`,
          'The review itself can be published again later',
        ],
        confirmLabel: 'Reject review',
      });
      if (!confirmed) return;
    }
    onModerate({ status: 'rejected' }, 'Rejected. It will not appear on the site.');
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete this review permanently?',
      message: 'Rejecting is usually the better option — it hides the review and keeps the record.',
      consequences: [
        'Removes the review and its rating from the product average',
        photos.length > 0 ? photoLine('Deletes') : 'The review has no photos',
        'Cannot be undone',
      ],
      confirmLabel: 'Delete review',
      typeToConfirm: 'delete',
    });
    if (!confirmed) return;
    onDelete();
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {review.status !== 'published' && (
        <Button
          size="sm"
          loading={saving}
          onClick={() => onModerate({ status: 'published' }, 'Published — it is on the product page now.')}
        >
          Publish
        </Button>
      )}

      {review.status === 'published' && (
        <Button
          variant="outline"
          size="sm"
          disabled={saving}
          onClick={() => onModerate({ status: 'pending' }, 'Pulled from the product page.')}
        >
          Unpublish
        </Button>
      )}

      {review.status !== 'rejected' && (
        <Button variant="outline" size="sm" disabled={saving} onClick={handleReject}>
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Reject
        </Button>
      )}

      <ReviewReplyForm
        reviewId={review.id}
        current={review.admin_response}
        saving={saving}
        onSave={(response) =>
          onModerate({ adminResponse: response }, response ? 'Reply saved.' : 'Reply removed.')
        }
      />

      <Link
        href={`/products/${review.product_id}#reviews`}
        target="_blank"
        className="inline-flex h-9 items-center gap-1.5 px-2 text-body-sm text-text-secondary hover:text-text-primary"
      >
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
        View on site
      </Link>

      <Button
        variant="ghost"
        size="sm"
        disabled={saving}
        className="text-destructive"
        onClick={handleDelete}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete
      </Button>
    </div>
  );
}
