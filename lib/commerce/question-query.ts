/**
 * COMMERCE layer (server only) — reading a product's answered questions.
 *
 * Server-rendered for the same reason the reviews are: a question in a
 * customer's own words, with the shop's answer under it, is indexable text
 * about a product whose own description is two lines. Fetched from an effect it
 * would be text no crawler ever sees.
 *
 * Through the service-role client, because product_questions holds the asker's
 * email address and rows nobody has vetted — anon has no grant on it
 * (migration 003400) and PublicQuestion is the allowlist of what may leave.
 *
 * Cached under the listing's `products` tag, so an admin answering a question
 * drops it: withAdminAuth revalidates that tag after every successful mutation,
 * which means a published answer appears with no invalidation call of its own
 * to forget.
 */
import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { PRODUCTS_CACHE_TAG } from './product-cache';
import type { PublicQuestion } from './questions';

const CACHE_SECONDS = 60;

/**
 * How many the page renders. All of them, up to this — the same argument as
 * REVIEWS_ON_PAGE: text behind a click is text a crawler may not follow.
 */
export const QUESTIONS_ON_PAGE = 20;

/** Only the columns a shopper may see. asker_email and moderation_note are
 *  absent by construction rather than by remembering to delete them. */
const PUBLIC_QUESTION_SELECT = 'id, body, asker_name, answer, answered_at, created_at';

export interface ProductQuestionsData {
  questions: PublicQuestion[];
  /** Every published question, not just the page of them above. */
  total: number;
}

const NONE: ProductQuestionsData = { questions: [], total: 0 };

async function fetchProductQuestions(productId: string): Promise<ProductQuestionsData> {
  const supabase = createAdminClient();

  const { data, error, count } = await supabase
    .from('product_questions')
    .select(PUBLIC_QUESTION_SELECT, { count: 'exact' })
    .eq('product_id', productId)
    .eq('status', 'published')
    // Oldest first: the question asked earliest is usually the obvious one
    // everybody has, and its answer has had the longest to be corrected.
    .order('created_at', { ascending: true })
    .limit(QUESTIONS_ON_PAGE);

  if (error) {
    // A product page must render without its Q&A. Failing here would take down
    // the page somebody actually came for.
    console.error('Question load failed:', error.message);
    return NONE;
  }

  return {
    questions: (data ?? []) as unknown as PublicQuestion[],
    total: count ?? 0,
  };
}

export function loadProductQuestions(productId: string): Promise<ProductQuestionsData> {
  return unstable_cache(() => fetchProductQuestions(productId), ['product-questions', productId], {
    tags: [PRODUCTS_CACHE_TAG],
    revalidate: CACHE_SECONDS,
  })();
}
