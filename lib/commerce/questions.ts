/**
 * COMMERCE layer — what a product question is.
 *
 * Pure: no Next, no React, no Supabase. The same split reviews.ts uses, and
 * for the same reason — two types, one per audience, so the row carrying the
 * asker's email address and the moderator's private note cannot be handed to a
 * storefront component by accident.
 *
 * Server-side loading is in question-query.ts, the moderation rules in
 * question-moderation.ts.
 */

export const QUESTION_STATUSES = ['pending', 'published', 'rejected'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const MAX_QUESTION_BODY = 1000;
export const MAX_QUESTION_ANSWER = 2000;

/**
 * A question as the storefront receives it.
 *
 * `answer` is not optional in practice: a question cannot be published without
 * one (see question-moderation.ts), so anything the storefront gets has been
 * answered. It stays nullable in the type because the column is, and a type
 * that lies about the database is worse than one that is slightly loose.
 */
export interface PublicQuestion {
  id: string;
  body: string;
  asker_name: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
}

/** A question as the moderation queue receives it, private columns included. */
export interface AdminQuestion {
  id: string;
  product_id: string;
  body: string;
  asker_name: string;
  asker_email: string;
  answer: string | null;
  answered_at: string | null;
  answered_by: string | null;
  answer_notified_at: string | null;
  status: QuestionStatus;
  moderation_note: string | null;
  created_at: string;
  published_at: string | null;
  /** Embedded by the admin query, so the queue reads as "this question, about
   *  that product" without a request per row. */
  products: { name: string; main_image: string | null } | null;
}

/** Admin-facing wording for a status. */
export function questionStatusLabel(status: string): string {
  switch (status) {
    case 'published': return 'Published';
    case 'rejected': return 'Rejected';
    case 'pending': return 'Needs an answer';
    default: return status;
  }
}

/**
 * The heading a Q&A section uses.
 *
 * Here rather than in the component because the empty case is a different
 * sentence, not a count of zero, and both surfaces that could show it should
 * agree on the wording.
 */
export function questionCountLabel(count: number): string {
  if (count === 0) return 'No questions yet';
  return `${count} ${count === 1 ? 'question' : 'questions'} answered`;
}
