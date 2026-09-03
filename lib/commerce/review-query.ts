/**
 * COMMERCE layer (server only) — reading reviews.
 *
 * Two very different reads live here on purpose:
 *
 *   * loadProductReviews — one product's published reviews plus its aggregate,
 *     for the product page. Server-rendered, because the whole SEO argument
 *     for reviews is that the text is in the HTML a crawler receives. Fetching
 *     it from an effect would produce the stars and none of the content.
 *
 *   * attachReviewStats — the star row on a product card, for the listing and
 *     the recommendation rails. One indexed read over product_review_stats for
 *     the ids already on screen, merged in TypeScript rather than bolted onto
 *     list_products()' return type: the projection is shared by four surfaces
 *     and changing its shape means re-emitting a 150-line function per
 *     migration.
 *
 * Both go through the service-role client. product_reviews holds reviewer
 * email addresses and rows no moderator has approved, so anon has no grant on
 * it (migration 003300) and PublicReview is the allowlist of what may leave.
 *
 * Cached under the listing's `products` tag, so an admin publishing a review
 * drops it — withAdminAuth already revalidates that tag after every successful
 * admin mutation, which means moderation shows up immediately with no
 * invalidation call of its own to forget.
 */
import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { PRODUCTS_CACHE_TAG } from './product-cache';
import { reviewPhotoUrl, type PublicReview } from './reviews';
import { NO_REVIEWS, toReviewStats, type ReviewStats } from './rating-math';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Matches the listing's window. Reviews change rarely, but they change through
 *  the same tag, so there is nothing to gain from a longer one. */
const CACHE_SECONDS = 60;

/**
 * How many reviews the page renders.
 *
 * All of them, up to this. There is no "show more": text behind a click is
 * text a crawler may not follow, and hiding the fourth review of a product
 * with four reviews helps nobody.
 */
export const REVIEWS_ON_PAGE = 20;

/** Only the columns a shopper may see. author_email and moderation_note are
 *  absent by construction rather than by remembering to delete them. */
const PUBLIC_REVIEW_SELECT =
  'id, rating, title, body, author_name, variant_label, is_verified_purchase, photo_paths, admin_response, created_at';

export interface ProductReviewsData {
  reviews: PublicReview[];
  stats: ReviewStats;
}

const NONE: ProductReviewsData = { reviews: [], stats: NO_REVIEWS };

/** Read once here rather than in the pure helper, which takes the base as an
 *  argument so it stays testable. */
function storageBase(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
}

function toPublicReview(row: Record<string, any>, base: string): PublicReview {
  return {
    id: row.id,
    rating: Number(row.rating),
    title: row.title ?? null,
    body: row.body ?? null,
    author_name: row.author_name,
    variant_label: row.variant_label ?? null,
    is_verified_purchase: row.is_verified_purchase === true,
    photos: ((row.photo_paths ?? []) as string[]).map((path) => reviewPhotoUrl(path, base)),
    admin_response: row.admin_response ?? null,
    created_at: row.created_at,
  };
}

async function fetchProductReviews(productId: string): Promise<ProductReviewsData> {
  const supabase = createAdminClient();

  const [reviewsResult, statsResult] = await Promise.all([
    supabase
      .from('product_reviews')
      .select(PUBLIC_REVIEW_SELECT)
      .eq('product_id', productId)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(REVIEWS_ON_PAGE),
    supabase.from('product_review_stats').select('*').eq('product_id', productId).maybeSingle(),
  ]);

  if (reviewsResult.error) {
    // A product page must render without its reviews. Failing here would take
    // down the page someone actually came for.
    console.error('Review load failed:', reviewsResult.error.message);
    return NONE;
  }

  const base = storageBase();

  return {
    reviews: (reviewsResult.data ?? []).map((row) => toPublicReview(row as Record<string, any>, base)),
    // The aggregate counts every published review, not just the page of them
    // above — "4.8 from 63 reviews" over twenty rendered reviews is correct.
    stats: toReviewStats(statsResult.data as Record<string, unknown> | null),
  };
}

export function loadProductReviews(productId: string): Promise<ProductReviewsData> {
  return unstable_cache(() => fetchProductReviews(productId), ['product-reviews', productId], {
    tags: [PRODUCTS_CACHE_TAG],
    revalidate: CACHE_SECONDS,
  })();
}

/** What a card needs from the aggregate, and nothing else. */
export interface CardReviewStats {
  rating_average: number;
  review_count: number;
}

/**
 * Stats for a set of product ids, keyed by id. Products with no published
 * reviews are simply absent — the card then renders no star row at all, which
 * is the honest answer and better than "0.0 (0)".
 */
export async function loadCardReviewStats(
  productIds: string[],
  supabase: SupabaseClient = createAdminClient()
): Promise<Map<string, CardReviewStats>> {
  const found = new Map<string, CardReviewStats>();
  if (productIds.length === 0) return found;

  const { data, error } = await supabase
    .from('product_review_stats')
    .select('product_id, review_count, rating_average')
    .in('product_id', productIds);

  if (error) {
    // Stars are an enhancement to a card that already works.
    console.error('Card review stats failed:', error.message);
    return found;
  }

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const stats = toReviewStats(row);
    if (stats.review_count > 0) {
      found.set(String(row.product_id), {
        rating_average: stats.rating_average,
        review_count: stats.review_count,
      });
    }
  }

  return found;
}

/**
 * Merges the star row into a page of card rows, in place of the caller doing
 * it. Used by the listing, the homepage and every recommendation rail, so a
 * card shows the same rating wherever it appears.
 *
 * The client is optional: a caller mid-query passes the one it already has,
 * and a caller that has none (the homepage, which reads products through the
 * public client) gets a service-role one — which it needs, because anon holds
 * no grant on the stats view.
 */
export async function attachReviewStats<T extends { id: string }>(
  rows: T[],
  supabase: SupabaseClient = createAdminClient()
): Promise<Array<T & Partial<CardReviewStats>>> {
  if (rows.length === 0) return rows;

  const stats = await loadCardReviewStats(rows.map((row) => row.id), supabase);
  if (stats.size === 0) return rows;

  return rows.map((row) => ({ ...row, ...stats.get(row.id) }));
}
