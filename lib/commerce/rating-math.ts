/**
 * COMMERCE layer — the arithmetic every star on the site is drawn from.
 *
 * Split from reviews.ts, which is now purely the shapes: this file is the
 * numbers. The average a card shows, the average the JSON-LD claims, the
 * distribution bars and the fill of each individual star all come from here,
 * so they cannot round differently or disagree about what "4.65 out of 5"
 * looks like — which, between a search-result star rating and the product page
 * it links to, is a mismatch Google issues manual actions over.
 *
 * Pure, and the most heavily tested part of the feature for that reason.
 */

/** One row of product_review_stats. Zero-filled when a product has no reviews. */
export interface ReviewStats {
  review_count: number;
  /** 1–5, to two decimals. `numeric` arrives from Supabase as a string. */
  rating_average: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
  verified_count: number;
}

export const NO_REVIEWS: ReviewStats = {
  review_count: 0,
  rating_average: 0,
  five_star: 0,
  four_star: 0,
  three_star: 0,
  two_star: 0,
  one_star: 0,
  verified_count: 0,
};

/**
 * Normalises a product_review_stats row.
 *
 * `numeric` comes back from PostgREST as a string ("4.67"), and every caller
 * wants a number — one that has been checked, because a NaN reaching the
 * JSON-LD is a structured-data error Google reports rather than ignores.
 */
export function toReviewStats(row: Partial<Record<keyof ReviewStats, unknown>> | null | undefined): ReviewStats {
  if (!row) return NO_REVIEWS;

  const count = int(row.review_count);
  if (count <= 0) return NO_REVIEWS;

  const average = Number(row.rating_average);

  return {
    review_count: count,
    rating_average: Number.isFinite(average) ? clampRating(average) : 0,
    five_star: int(row.five_star),
    four_star: int(row.four_star),
    three_star: int(row.three_star),
    two_star: int(row.two_star),
    one_star: int(row.one_star),
    verified_count: int(row.verified_count),
  };
}

function int(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function clampRating(value: number): number {
  return Math.min(5, Math.max(0, value));
}

/** One decimal place, the way every shop writes it: "4.7", not "4.67". */
export function formatRatingAverage(average: number): string {
  return clampRating(average).toFixed(1);
}

/**
 * The sentence a screen reader hears in place of five star glyphs.
 *
 * Stars are decorative markup; this is the actual content, so it is built once
 * here rather than assembled inline at each of the four places stars appear.
 */
export function ratingAriaLabel(average: number, count?: number): string {
  const stars = `Rated ${formatRatingAverage(average)} out of 5`;
  if (count === undefined) return stars;
  return `${stars} from ${count} ${count === 1 ? 'review' : 'reviews'}`;
}

export interface RatingBar {
  rating: 1 | 2 | 3 | 4 | 5;
  count: number;
  /** Rounded whole percent of all reviews, for the bar's width. */
  percent: number;
}

/**
 * The distribution, five to one — the order the bars are drawn in.
 *
 * Percentages are of the total review count, so they sum to 100 (give or take
 * rounding) and a product with two five-star reviews shows a full bar rather
 * than a bar that means nothing without the count beside it.
 */
export function ratingDistribution(stats: ReviewStats): RatingBar[] {
  const total = stats.review_count;
  const counts: Array<[RatingBar['rating'], number]> = [
    [5, stats.five_star],
    [4, stats.four_star],
    [3, stats.three_star],
    [2, stats.two_star],
    [1, stats.one_star],
  ];

  return counts.map(([rating, count]) => ({
    rating,
    count,
    percent: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
}

/**
 * How full each of the five stars is, left to right, as a 0–1 fraction.
 *
 * Returning fractions rather than a filled/empty boolean is what lets 4.6
 * render as four solid stars and a mostly-filled fifth. A rounded integer
 * would show 4.6 and 4.4 identically, which is the difference the shopper is
 * actually reading.
 */
export function starFractions(average: number): number[] {
  const value = clampRating(average);
  return [0, 1, 2, 3, 4].map((index) => Math.min(1, Math.max(0, value - index)));
}
