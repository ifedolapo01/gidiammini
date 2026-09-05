/**
 * COMMERCE layer (server only) — the people and the products behind a worklist
 * count.
 *
 * The other half of the worklist, split from the order tasks because they
 * share nothing but a return type: these read the moderation queues and the
 * catalogue, and none of them is about money.
 *
 * No inline actions here on purpose. Answering a question and publishing a
 * review are both writing, and a text box in a dashboard row invites a
 * one-line answer to a question that deserves a real one; adjusting stock
 * needs the variant table beside it. Every row links to the screen built for
 * the job.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorklistEntry, WorklistResult } from '@/types/worklist';
import { daysWaiting } from './payment-outcome';

/** "3 days ago", or nothing on the day it was written. */
function since(date: string): string | null {
  const days = daysWaiting(date);
  if (days === 0) return null;
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Shopper questions with no answer yet — somebody deciding without one. */
export async function unansweredQuestions(
  supabase: SupabaseClient,
  limit: number
): Promise<WorklistResult> {
  const { data } = await supabase
    .from('product_questions')
    .select('id, body, asker_name, created_at, products (name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit + 1);

  const rows = (data ?? []).slice(0, limit);

  return {
    task: 'questions',
    truncated: (data ?? []).length > limit,
    entries: rows.map((question: any): WorklistEntry => ({
      id: question.id,
      // The question itself is the line worth reading, not the asker's name —
      // it is what decides whether this takes ten seconds or a phone call.
      title: question.body,
      subtitle: `${question.asker_name} · ${question.products?.name ?? 'Unknown product'}`,
      meta: since(question.created_at),
      href: '/admin/questions',
    })),
  };
}

/** Reviews written but not yet published — invisible to shoppers until they are. */
export async function reviewsToModerate(
  supabase: SupabaseClient,
  limit: number
): Promise<WorklistResult> {
  const { data } = await supabase
    .from('product_reviews')
    .select('id, rating, title, author_name, created_at, products (name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit + 1);

  const rows = (data ?? []).slice(0, limit);

  return {
    task: 'reviews',
    truncated: (data ?? []).length > limit,
    entries: rows.map((review: any): WorklistEntry => ({
      id: review.id,
      title: review.title || `${review.rating}★ from ${review.author_name}`,
      subtitle: `${review.rating}★ · ${review.products?.name ?? 'Unknown product'}`,
      meta: since(review.created_at),
      href: '/admin/reviews',
    })),
  };
}

/** Products nobody can buy. The most urgent thing the worklist can say. */
export async function outOfStockProducts(
  supabase: SupabaseClient,
  limit: number
): Promise<WorklistResult> {
  return stockRows(supabase, limit, 'out-of-stock');
}

/** Products about to become the above. */
export async function lowStockProducts(
  supabase: SupabaseClient,
  limit: number
): Promise<WorklistResult> {
  return stockRows(supabase, limit, 'low-stock');
}

/** Both stock tasks are the same query with a different band. */
async function stockRows(
  supabase: SupabaseClient,
  limit: number,
  task: 'out-of-stock' | 'low-stock'
): Promise<WorklistResult> {
  const query = supabase
    .from('products')
    .select('id, name, category, stock')
    .eq('is_active', true)
    .order('stock', { ascending: true })
    .limit(limit + 1);

  const { data } =
    task === 'out-of-stock'
      ? await query.lte('stock', 0)
      : await query.gt('stock', 0).lte('stock', 5);

  const rows = (data ?? []).slice(0, limit);

  return {
    task,
    truncated: (data ?? []).length > limit,
    entries: rows.map((product: any): WorklistEntry => ({
      id: product.id,
      title: product.name,
      subtitle: product.category ?? 'Uncategorised',
      meta: product.stock <= 0 ? 'out of stock' : `${product.stock} left`,
      href: '/admin/stock',
    })),
  };
}
