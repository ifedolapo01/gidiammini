/**
 * STOREFRONT layer — one question and its answer.
 *
 * A description list, which is what this actually is: a term and its
 * definition. It also gives a screen reader the pairing for free — the answer
 * is announced as belonging to the question rather than as the next paragraph.
 *
 * Server-rendered, like the section around it. This is a customer's own
 * wording of an objection and the shop's answer to it: the most useful text on
 * the page for anybody searching that exact worry, and worth nothing at all if
 * it arrives after hydration.
 */
import { MessageCircleQuestion } from 'lucide-react';
import { formatDateOnly } from '@/lib/commerce/format-date';
import type { PublicQuestion } from '@/lib/commerce/questions';

interface QuestionCardProps {
  question: PublicQuestion;
}

export default function QuestionCard({ question }: QuestionCardProps) {
  return (
    <div className="border-b border-divider py-4 last:border-b-0">
      <dt className="flex items-start gap-2">
        <MessageCircleQuestion
          className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary"
          aria-hidden="true"
        />
        <span className="text-body-md font-medium text-text-primary">{question.body}</span>
      </dt>

      {question.answer && (
        <dd className="mt-2 ml-6 border-l-2 border-primary pl-3">
          <p className="whitespace-pre-line text-body-md text-text-secondary">{question.answer}</p>
          <p className="mt-1 text-caption-md text-text-muted">
            GidiamMini
            {question.answered_at && (
              <>
                {' · '}
                <time dateTime={question.answered_at}>
                  {formatDateOnly(question.answered_at)}
                </time>
              </>
            )}
          </p>
        </dd>
      )}

      <dd className="mt-1 ml-6 text-caption-md text-text-muted">
        Asked by {question.asker_name} ·{' '}
        <time dateTime={question.created_at}>{formatDateOnly(question.created_at)}</time>
      </dd>
    </div>
  );
}
