/**
 * ADMIN layer — writing the answer to a product question.
 *
 * Open by default when there is no answer yet, because that is the job this
 * page exists for: an unanswered question is work, not a yes/no decision, and
 * hiding the box behind a button would put a click in front of the only thing
 * the admin came here to do. Once answered it collapses, so a queue of
 * answered questions stays scannable.
 *
 * Two buttons, because they are two different acts. "Answer & publish" is the
 * normal one and does both — the answer, the product page, and the email to
 * the person who asked, in one click. "Save without publishing" is for an
 * answer that needs checking with somebody first; the API refuses to publish
 * an empty answer either way.
 */
'use client';

import { useState } from 'react';
import { Button, Textarea } from '@/components/ui';
import { MAX_QUESTION_ANSWER } from '@/lib/commerce/questions';

interface QuestionAnswerFormProps {
  questionId: string;
  /** The answer as stored, so cancelling restores it rather than blanking it. */
  current: string | null;
  published: boolean;
  saving: boolean;
  onSave: (answer: string, publish: boolean) => void;
}

export default function QuestionAnswerForm({
  questionId,
  current,
  published,
  saving,
  onSave,
}: QuestionAnswerFormProps) {
  const [open, setOpen] = useState(!current);
  const [draft, setDraft] = useState(current ?? '');
  const fieldId = `answer-${questionId}`;

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit answer
      </Button>
    );
  }

  const empty = draft.trim() === '';

  return (
    <div className="w-full">
      <label htmlFor={fieldId} className="mb-1 block text-caption-md font-medium text-text-primary">
        Your answer — shown publicly under the question, and emailed to whoever asked
      </label>
      <Textarea
        id={fieldId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={MAX_QUESTION_ANSWER}
        rows={4}
        placeholder="It runs a little generously — a chunky six-month-old is usually happier in the 6-9M."
      />

      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="sm"
          loading={saving}
          disabled={empty}
          onClick={() => onSave(draft, true)}
        >
          {published ? 'Update answer' : 'Answer & publish'}
        </Button>

        {!published && (
          <Button
            variant="outline"
            size="sm"
            disabled={saving || empty}
            onClick={() => onSave(draft, false)}
          >
            Save without publishing
          </Button>
        )}

        {current && (
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => {
              setDraft(current);
              setOpen(false);
            }}
          >
            Cancel
          </Button>
        )}
      </div>

      {empty && (
        <p className="mt-1 text-caption-md text-text-secondary">
          {'A question cannot be published without an answer — an unanswered one on the product page reads worse than no Q&A at all.'}
        </p>
      )}
    </div>
  );
}
