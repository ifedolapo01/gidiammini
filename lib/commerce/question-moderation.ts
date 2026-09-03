/**
 * COMMERCE layer — what a moderator's decision does to a question.
 *
 * Pure, and the reason it is its own module: one of these rules is a product
 * decision worth being able to test without a request.
 *
 * PUBLISHING REQUIRES AN ANSWER
 *
 * A published question with nothing under it is a visible unanswered doubt on
 * the product page — it reads as "somebody asked and nobody could be
 * bothered", which is worse for trust than having no Q&A section at all. So
 * the plan refuses that combination rather than the UI merely discouraging it,
 * and it refuses it however you arrive: publishing an unanswered question, or
 * clearing the answer from one that is already published.
 */
import type { AuditAction } from '@/lib/api/audit';
import type { QuestionStatus } from './questions';

export interface QuestionModerationInput {
  status?: QuestionStatus;
  /** undefined leaves the answer alone; '' clears it. */
  answer?: string;
  moderationNote?: string;
}

export interface ModeratedQuestionRow {
  status: string;
  published_at: string | null;
  answer: string | null;
}

export type QuestionModerationPlan =
  | {
      ok: true;
      update: Record<string, unknown>;
      action: AuditAction;
      /** True when this change is what puts the answer on the product page —
       *  the moment the asker should be emailed. */
      publishes: boolean;
    }
  | { ok: false; error: string };

const blank = (value: string | null | undefined): boolean => !value || value.trim() === '';

/**
 * Turns a validated PATCH body into the row update it implies.
 *
 * `answeredBy` is the admin's email rather than an id: the admin is one shared
 * login, so there is no user row to point at.
 */
export function planQuestionModeration(
  input: QuestionModerationInput,
  existing: ModeratedQuestionRow,
  answeredBy: string | null
): QuestionModerationPlan {
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {};
  let action: AuditAction = 'update';

  // What the answer will be once this request is applied — which is what the
  // publish rule has to be checked against, not what it is now.
  const answer = input.answer !== undefined ? input.answer : existing.answer;
  const status = input.status ?? (existing.status as QuestionStatus);

  if (status === 'published' && blank(answer)) {
    return {
      ok: false,
      error: 'Write an answer before publishing — a published question with no answer under it reads worse than no Q&A at all.',
    };
  }

  if (input.answer !== undefined && input.answer !== (existing.answer ?? '')) {
    update.answer = blank(input.answer) ? null : input.answer.trim();
    update.answered_by = update.answer ? answeredBy : null;

    // Stamped once, like published_at: fixing a typo in an answer should not
    // move the date the page says it was answered on.
    if (update.answer && !existing.answer) {
      update.answered_at = now;
    } else if (!update.answer) {
      update.answered_at = null;
      // The old answer was mailed; a new one is a new thing to tell them.
      update.answer_notified_at = null;
    }
  }

  if (input.status && input.status !== existing.status) {
    update.status = input.status;

    if (input.status === 'published') {
      action = 'approve';
      if (!existing.published_at) update.published_at = now;
    }
    if (input.status === 'rejected') action = 'reject';
  }

  if (input.moderationNote !== undefined) {
    update.moderation_note = input.moderationNote || null;
  }

  return {
    ok: true,
    update,
    action,
    // Only when this request is the one that publishes it. Re-saving an
    // already-published question must not mail the asker again.
    publishes: update.status === 'published',
  };
}
