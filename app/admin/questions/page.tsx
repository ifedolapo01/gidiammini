/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/questions/page.tsx — the unanswered-question queue.
//
// The most time-sensitive page in the admin. Every row is a shopper who said
// out loud that something is stopping them buying, and who is deciding right
// now with the answer missing — so "Needs an answer" is the default tab and
// the oldest question is at the top.
//
// The list, its states and its paging come from the shared moderation surface
// that also drives /admin/reviews; what is specific here is the card, which
// carries the answer box.
'use client';

import { useState } from 'react';
import ModerationStatusTabs from '@/app/admin/components/ModerationStatusTabs';
import ModerationPanel from '@/app/admin/components/ModerationPanel';
import {
  useModerationQueue,
  type ModerationFilter,
} from '@/app/admin/hooks/useModerationQueue';
import type { AdminQuestion } from '@/lib/commerce/questions';
import type { QuestionModerationInput } from '@/lib/commerce/question-moderation';
import QuestionModerationCard from './components/QuestionModerationCard';

const TAB_LABELS: Record<ModerationFilter, string> = {
  pending: 'Needs an answer',
  published: 'Answered',
  rejected: 'Rejected',
  all: 'All',
};

const EMPTY_MESSAGE: Record<ModerationFilter, string> = {
  pending: 'Nothing waiting. A new question appears here as soon as somebody asks one.',
  published: 'Nothing answered yet. Answer a question and it appears on its product page.',
  rejected: 'No rejected questions.',
  all: 'No questions yet. Shoppers can ask from any product page.',
};

export default function AdminQuestionsPage() {
  const [filter, setFilter] = useState<ModerationFilter>('pending');
  const queue = useModerationQueue<AdminQuestion, QuestionModerationInput>('questions', filter);

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <header>
        <h1 className="text-body-lg font-bold text-text-primary sm:text-h5 md:text-h4">
          Questions
        </h1>
        <p className="mt-1 text-caption-md text-text-secondary sm:text-body-sm">
          Anyone can ask about a product, so nothing here is visible until you answer
          it. Answering emails the person who asked and puts the answer on the product
          page, where the next person will find it.
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
        loadingMessage="Loading questions…"
        page={queue.page}
        pageCount={queue.pageCount}
        total={queue.total}
        onPageChange={queue.goToPage}
        noun="question"
      >
        {queue.items.map((question) => (
          <QuestionModerationCard
            key={question.id}
            question={question}
            saving={queue.saving === question.id}
            onModerate={(change, message) => queue.moderate(question.id, change, message)}
            onDelete={() => queue.remove(question.id, 'Question deleted.')}
          />
        ))}
      </ModerationPanel>
    </div>
  );
}
