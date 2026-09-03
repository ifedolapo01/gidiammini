/**
 * ADMIN layer — the shop's public reply to a review.
 *
 * Worth having its own component because it is the one thing on the card that
 * is a draft rather than a decision: everything else is a button, this is text
 * somebody writes and rewrites. Kept collapsed until asked for, so the queue
 * stays scannable when the answer to most reviews is "publish".
 *
 * A reply is public. The label says so, because the alternative is a moderator
 * writing "customer is wrong, refunded as goodwill" into what turns out to be
 * a product page.
 */
'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button, Textarea } from '@/components/ui';

interface ReviewReplyFormProps {
  /** Makes the textarea's id unique — several cards render this form. */
  reviewId: string;
  /** The reply as stored, so cancelling restores it rather than blanking it. */
  current: string | null;
  saving: boolean;
  onSave: (response: string) => void;
}

export default function ReviewReplyForm({ reviewId, current, saving, onSave }: ReviewReplyFormProps) {
  const fieldId = `admin-response-${reviewId}`;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(current ?? '');

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
        {current ? 'Edit reply' : 'Reply publicly'}
      </Button>
    );
  }

  return (
    <div className="w-full">
      <label
        htmlFor={fieldId}
        className="mb-1 block text-caption-md font-medium text-text-primary"
      >
        Public reply — shown under this review on the product page
      </label>
      <Textarea
        id={fieldId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="Thank you for letting us know — we have changed the size guide on this one."
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" loading={saving} onClick={() => onSave(draft)}>
          Save reply
        </Button>
        {/* Clearing is a separate act from saving an empty box, and it is
            offered only when there is something to clear. */}
        {current && (
          <Button variant="outline" size="sm" disabled={saving} onClick={() => onSave('')}>
            Remove reply
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={() => {
            setDraft(current ?? '');
            setOpen(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
