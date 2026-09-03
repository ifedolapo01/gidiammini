/**
 * COMMERCE layer — what a review is, and the arithmetic on a pile of them.
 *
 * Pure: no Next, no React, no Supabase. Every shape the storefront and the
 * admin both read is declared here, and only here — the two review types are
 * separate on purpose, so an admin row carrying a reviewer's email address
 * cannot be handed to a storefront component by accident.
 *
 * The arithmetic over these lives in rating-math.ts, server-side loading in
 * review-query.ts, and the invite flow in review-invite.ts. This file is the
 * vocabulary all three speak.
 */

export const REVIEW_STATUSES = ['pending', 'published', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Ceiling on photos per review, matching the CHECK on product_reviews. */
export const MAX_REVIEW_PHOTOS = 4;

/** Longest review body accepted, matching the column's CHECK. */
export const MAX_REVIEW_BODY = 4000;

export const MAX_REVIEW_TITLE = 120;

/** The public bucket customer photos live in. */
export const REVIEW_PHOTOS_BUCKET = 'review-photos';

/**
 * A review as the storefront receives it.
 *
 * Deliberately not the table row: author_email, moderation_note and the
 * moderator's timestamps never leave the server. Anything added to the table
 * has to be added here on purpose before a shopper can see it.
 */
export interface PublicReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  author_name: string;
  variant_label: string | null;
  is_verified_purchase: boolean;
  /** Absolute URLs, resolved on the server from the stored object paths. */
  photos: string[];
  admin_response: string | null;
  created_at: string;
}

/**
 * A review as the moderation queue receives it.
 *
 * The private columns are here and deliberately not in PublicReview:
 * author_email, so a moderator can reply to a person, and moderation_note,
 * which is theirs. The two types existing separately is what makes it
 * impossible to hand an admin row to a storefront component by accident.
 */
export interface AdminReview {
  id: string;
  product_id: string;
  order_id: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  author_name: string;
  author_email: string;
  variant_label: string | null;
  /** Stored object paths. The admin list renders them through reviewPhotoUrl. */
  photo_paths: string[] | null;
  status: ReviewStatus;
  moderation_note: string | null;
  admin_response: string | null;
  admin_responded_at: string | null;
  is_verified_purchase: boolean;
  created_at: string;
  published_at: string | null;
  /** Embedded by the admin query, so the queue reads as "this review, of that
   *  product" without a request per row. */
  products: { name: string; main_image: string | null } | null;
  orders: { order_number: string } | null;
}

/** The public bucket URL for a stored photo path. Base passed in, so this
 *  stays testable and the environment is read at the one place that knows it. */
export function reviewPhotoUrl(path: string, supabaseUrl: string): string {
  const base = supabaseUrl.replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/${REVIEW_PHOTOS_BUCKET}/${path}`;
}

/** Admin-facing wording for a status. */
export function reviewStatusLabel(status: string): string {
  switch (status) {
    case 'published': return 'Published';
    case 'rejected': return 'Rejected';
    case 'pending': return 'Awaiting review';
    default: return status;
  }
}
