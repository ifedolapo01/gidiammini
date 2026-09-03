/**
 * Request schemas for asking and answering a product question.
 *
 * The ask is the only unauthenticated write in the reviews/Q&A feature that
 * has no purchase behind it — a question comes from somebody who has *not*
 * bought yet, which is the whole point of it. So it is shaped like the contact
 * form: honeypot, length caps, and a real email, with moderation as the thing
 * that keeps anything unvetted off the product page.
 */
import { z } from 'zod';
import { emailField, nameField, requiredText, honeypotFields } from './common';
import { MAX_QUESTION_ANSWER, MAX_QUESTION_BODY, QUESTION_STATUSES } from '@/lib/commerce/questions';

export const askQuestionSchema = z.object({
  ...honeypotFields,
  productId: z.string().uuid('That product could not be identified.'),
  question: requiredText('A question', MAX_QUESTION_BODY),
  /** Shown beside the question on the product page. */
  name: nameField,
  /**
   * Required, and the form says why: it is how the answer gets back to them.
   * It is never displayed and never subscribed to anything.
   */
  email: emailField,
});

export type AskQuestionBody = z.infer<typeof askQuestionSchema>;

/** A field a PATCH may leave alone: undefined means "leave it", '' means
 *  "clear it". Same reasoning as the review moderation schema's editableText. */
function editableText(label: string, max: number) {
  return z
    .string({ error: `${label} must be text.` })
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .optional();
}

/**
 * A moderator's decision.
 *
 * Answering and publishing are separate fields but usually one request: the
 * admin form sends both, because "answer and publish" is the single act they
 * are performing. planQuestionModeration refuses the combination that would
 * put an unanswered question on a product page.
 */
export const questionModerationSchema = z
  .object({
    status: z.enum(QUESTION_STATUSES).optional(),
    answer: editableText('An answer', MAX_QUESTION_ANSWER),
    moderationNote: editableText('A note', 1000),
  })
  .refine(
    (body) => body.status !== undefined || body.answer !== undefined || body.moderationNote !== undefined,
    { error: 'Nothing to change.' }
  );

export type QuestionModerationBody = z.infer<typeof questionModerationSchema>;
