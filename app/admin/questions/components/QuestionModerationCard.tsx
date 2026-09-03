/**
 * ADMIN layer — one question, and the answer being written to it.
 *
 * A card, like the review queue's, and for the same reason: this is a
 * paragraph somebody wrote and a paragraph somebody is about to write, which
 * are not table columns.
 *
 * The mail state is on the card on purpose. The answer being emailed to the
 * asker is the whole reason their address was required, so "Answer emailed" is
 * a fact the admin should be able to see rather than trust.
 */
'use client';

import { ExternalLink, MailCheck, Trash2, XCircle } from 'lucide-react';
import Link from 'next/link';
import ProductImage from '@/components/commerce/ProductImage';
import { Badge, Button } from '@/components/ui';
import { formatDate } from '@/lib/commerce/format-date';
import { questionStatusLabel, type AdminQuestion } from '@/lib/commerce/questions';
// The route's own input type, so the card cannot invent a field the API would
// strip. Type-only, so nothing server-side reaches the bundle.
import type { QuestionModerationInput } from '@/lib/commerce/question-moderation';
import QuestionAnswerForm from './QuestionAnswerForm';

const STATUS_TONE = {
  pending: 'warning',
  published: 'success',
  rejected: 'destructive',
} as const;

interface QuestionModerationCardProps {
  question: AdminQuestion;
  saving: boolean;
  onModerate: (change: QuestionModerationInput, successMessage: string) => void;
  onDelete: () => void;
}

export default function QuestionModerationCard({
  question,
  saving,
  onModerate,
  onDelete,
}: QuestionModerationCardProps) {
  const published = question.status === 'published';

  return (
    <li className="border-b border-divider p-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ProductImage
            src={question.products?.main_image}
            alt=""
            sizes="48px"
            className="h-12 w-12 shrink-0 rounded-control"
          />
          <div className="min-w-0">
            <p className="truncate text-body-md font-semibold text-text-primary">
              {question.products?.name ?? 'Deleted product'}
            </p>
            <p className="mt-0.5 text-caption-md text-text-secondary">
              Asked {formatDate(question.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {question.answer_notified_at && (
            <Badge tone="info" variant="outline">
              <MailCheck className="h-3 w-3" aria-hidden="true" />
              Answer emailed
            </Badge>
          )}
          <Badge tone={STATUS_TONE[question.status]}>{questionStatusLabel(question.status)}</Badge>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <blockquote className="border-l-2 border-border-strong pl-3 text-body-md text-text-primary">
          {question.body}
        </blockquote>

        {question.answer && (
          <div className="rounded-control bg-background-secondary p-3">
            <p className="text-caption-md font-semibold text-text-primary">
              Answered{question.answered_at ? ` ${formatDate(question.answered_at)}` : ''}
              {question.answered_by ? ` by ${question.answered_by}` : ''}
            </p>
            <p className="mt-1 whitespace-pre-line text-body-sm text-text-secondary">
              {question.answer}
            </p>
          </div>
        )}

        <p className="text-caption-md text-text-secondary">
          {question.asker_name} · {question.asker_email}
        </p>

        <QuestionAnswerForm
          questionId={question.id}
          current={question.answer}
          published={published}
          saving={saving}
          onSave={(answer, publish) =>
            onModerate(
              publish ? { answer, status: 'published' } : { answer },
              publish
                ? 'Answered and published — the asker has been emailed.'
                : 'Answer saved. It is not on the product page yet.'
            )
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          {published && (
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => onModerate({ status: 'pending' }, 'Pulled from the product page.')}
            >
              Unpublish
            </Button>
          )}

          {question.status !== 'rejected' && (
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() =>
                onModerate({ status: 'rejected' }, 'Rejected. It will not appear on the site.')
              }
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Reject
            </Button>
          )}

          <Link
            href={`/products/${question.product_id}#questions`}
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
            onClick={() => {
              if (!confirm('Delete this question permanently? Rejecting is usually the better option — it keeps the record.')) return;
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>
    </li>
  );
}
