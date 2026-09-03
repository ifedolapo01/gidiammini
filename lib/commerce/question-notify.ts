/**
 * COMMERCE layer (server only) — telling the asker their question was answered.
 *
 * Same three rules as the review invite and the restock mail, because it is
 * the same kind of job:
 *
 *   1. It fires on one transition — the moment a question is published with an
 *      answer under it. Re-saving an answered question does not mail again.
 *   2. The row is claimed before the send. answer_notified_at is what makes a
 *      second publish a no-op; it is cleared again if the answer is later
 *      removed, because a replacement answer is a new thing to tell them.
 *   3. It cannot fail the moderation. The admin's answer has already
 *      committed; a mail server having a bad afternoon must not turn a saved
 *      answer into an error they retry.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendOrderEmail } from '@/lib/email';
import { buildQuestionAnsweredEmail } from '@/lib/notifications/templates/question-answered-email';
import { absoluteUrl } from '@/lib/site-url';

export interface AnsweredQuestion {
  id: string;
  product_id: string;
  body: string;
  answer: string | null;
  asker_name: string;
  asker_email: string;
  answer_notified_at: string | null;
}

export interface QuestionNotifyResult {
  sent: boolean;
  reason?: string;
}

const NOT_SENT: QuestionNotifyResult = { sent: false };

/**
 * Mails the asker, once.
 *
 * The claim is a conditional UPDATE returning what it changed, so two
 * concurrent publishes cannot both send: whichever commits second updates
 * nothing and mails nobody.
 */
export async function notifyQuestionAnswered(
  supabase: SupabaseClient,
  question: AnsweredQuestion
): Promise<QuestionNotifyResult> {
  if (!question.answer || !question.asker_email) return NOT_SENT;

  const { data: claimed, error } = await supabase
    .from('product_questions')
    .update({ answer_notified_at: new Date().toISOString() })
    .eq('id', question.id)
    .is('answer_notified_at', null)
    .select('id');

  if (error) {
    console.error(`Question notification claim failed for ${question.id}:`, error.message);
    return NOT_SENT;
  }
  // Already mailed. Not an error — it is the guard doing its job.
  if (!claimed || claimed.length === 0) return NOT_SENT;

  const { data: product } = await supabase
    .from('products')
    .select('name')
    .eq('id', question.product_id)
    .maybeSingle();

  const { subject, html } = buildQuestionAnsweredEmail({
    askerName: question.asker_name,
    productName: (product?.name as string) ?? 'the product you asked about',
    productUrl: absoluteUrl(`/products/${question.product_id}#questions`),
    question: question.body,
    answer: question.answer,
  });

  const outcome = await sendOrderEmail(question.asker_email, subject, html);

  if (!outcome.success) {
    // Released, so a later publish (or a fixed mail server) can try again.
    console.error(`Question answered email failed for ${question.id}: ${outcome.reason}`);
    await supabase
      .from('product_questions')
      .update({ answer_notified_at: null })
      .eq('id', question.id);

    return { sent: false, reason: outcome.reason };
  }

  return { sent: true };
}

/** The wrapper the admin route calls. Swallows everything — see rule 3. */
export async function notifyIfAnswerPublished(
  supabase: SupabaseClient,
  question: AnsweredQuestion,
  publishes: boolean
): Promise<QuestionNotifyResult> {
  if (!publishes) return NOT_SENT;

  try {
    return await notifyQuestionAnswered(supabase, question);
  } catch (cause) {
    console.error(`Question notification failed for ${question.id}:`, cause);
    return NOT_SENT;
  }
}
