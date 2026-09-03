/**
 * STOREFRONT layer — the Q&A section of a product page.
 *
 * The answered questions are server-rendered; only the ask form is client
 * code. A question in a customer's own words with the shop's answer under it
 * is the most persuasive copy on the page and the long-tail text this
 * catalogue does not otherwise have, and none of that counts if it arrives
 * after hydration.
 *
 * NO FAQPage OR QAPage MARKUP, DELIBERATELY
 *
 * It would be easy to wrap this in schema.org FAQPage and it would be wrong
 * twice over: FAQ rich results are limited to authoritative health and
 * government sites, and QAPage describes a page whose primary subject is a
 * single user question — which a product page is not. Marking this up as
 * either would be telling a crawler something untrue about the page in the
 * hope of a rich result it is not eligible for. The visible text is the SEO
 * value here; the structured data on this page stays Product plus its
 * aggregateRating.
 */
import { questionCountLabel } from '@/lib/commerce/questions';
import type { ProductQuestionsData } from '@/lib/commerce/question-query';
import QuestionCard from './QuestionCard';
import AskQuestionForm from './AskQuestionForm';

interface ProductQuestionsProps {
  productId: string;
  /** Loaded by the page, alongside the reviews. */
  data: ProductQuestionsData;
}

export default function ProductQuestions({ productId, data }: ProductQuestionsProps) {
  const { questions, total } = data;

  return (
    <section id="questions" aria-labelledby="questions-heading" className="mt-12 scroll-mt-24">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="questions-heading" className="text-h5 font-bold text-text-primary">
          {'Questions & answers'}
        </h2>
        <p className="text-body-sm text-text-secondary">{questionCountLabel(total)}</p>
      </div>

      {questions.length === 0 ? (
        <p className="max-w-prose text-body-sm text-text-secondary">
          Nobody has asked about this one yet. If something is not clear — the fit,
          the fabric, what is included — ask and we will answer it here, so the next
          person does not have to.
        </p>
      ) : (
        // A description list: each question is a term, its answer the
        // definition. That pairing is what a screen reader reads out, rather
        // than two unrelated paragraphs.
        <dl>
          {questions.map((question) => (
            <QuestionCard key={question.id} question={question} />
          ))}
        </dl>
      )}

      {total > questions.length && (
        <p className="mt-2 text-caption-md text-text-secondary">
          Showing the first {questions.length} of {total}.
        </p>
      )}

      <AskQuestionForm productId={productId} />
    </section>
  );
}
