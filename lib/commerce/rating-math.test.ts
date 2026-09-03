/**
 * The arithmetic every star on the site is drawn from.
 *
 * Worth this much coverage because four surfaces render from these numbers —
 * the card, the summary, each review and the JSON-LD — and the one that
 * reaches Google is a claim about the others.
 *
 * The two formatting helpers that stayed in reviews.ts (the photo URL and the
 * status label) are covered at the end, rather than in a file of their own for
 * two cases.
 */
import { describe, it, expect } from 'vitest';
import { reviewPhotoUrl, reviewStatusLabel } from './reviews';
import {
  formatRatingAverage,
  ratingAriaLabel,
  ratingDistribution,
  starFractions,
  toReviewStats,
  NO_REVIEWS,
} from './rating-math';

const stats = (over: Partial<typeof NO_REVIEWS> = {}) => ({ ...NO_REVIEWS, ...over });

describe('toReviewStats', () => {
  it('parses the numeric average PostgREST sends as a string', () => {
    const parsed = toReviewStats({ review_count: '3', rating_average: '4.67' });
    expect(parsed.review_count).toBe(3);
    expect(parsed.rating_average).toBeCloseTo(4.67);
  });

  it('treats a missing row as no reviews rather than as a zero rating', () => {
    expect(toReviewStats(null)).toEqual(NO_REVIEWS);
    expect(toReviewStats(undefined)).toEqual(NO_REVIEWS);
  });

  it('refuses to report an average when there are no reviews to average', () => {
    // A view row with count 0 should not exist, but a 0-count row carrying an
    // average would put stars on a product nobody has reviewed.
    expect(toReviewStats({ review_count: 0, rating_average: '5' })).toEqual(NO_REVIEWS);
  });

  it('never emits NaN — it would be a structured-data error in the JSON-LD', () => {
    const parsed = toReviewStats({ review_count: 2, rating_average: 'not a number' });
    expect(parsed.rating_average).toBe(0);
  });

  it('clamps an out-of-range average', () => {
    expect(toReviewStats({ review_count: 1, rating_average: '9' }).rating_average).toBe(5);
  });
});

describe('formatRatingAverage', () => {
  it('shows one decimal, the way a shop writes it', () => {
    expect(formatRatingAverage(4.67)).toBe('4.7');
    expect(formatRatingAverage(5)).toBe('5.0');
  });
});

describe('ratingAriaLabel', () => {
  it('says the rating and the count as a sentence', () => {
    expect(ratingAriaLabel(4.6, 12)).toBe('Rated 4.6 out of 5 from 12 reviews');
  });

  it('uses the singular for one review', () => {
    expect(ratingAriaLabel(5, 1)).toBe('Rated 5.0 out of 5 from 1 review');
  });

  it('omits the count when there is none to give', () => {
    expect(ratingAriaLabel(3)).toBe('Rated 3.0 out of 5');
  });
});

describe('ratingDistribution', () => {
  it('runs five to one, the order the bars are drawn', () => {
    const bars = ratingDistribution(stats({ review_count: 4, five_star: 2, four_star: 1, one_star: 1 }));
    expect(bars.map((bar) => bar.rating)).toEqual([5, 4, 3, 2, 1]);
    expect(bars.map((bar) => bar.count)).toEqual([2, 1, 0, 0, 1]);
    expect(bars.map((bar) => bar.percent)).toEqual([50, 25, 0, 0, 25]);
  });

  it('does not divide by zero when there are no reviews', () => {
    expect(ratingDistribution(NO_REVIEWS).every((bar) => bar.percent === 0)).toBe(true);
  });
});

describe('starFractions', () => {
  it('keeps the fraction, so 4.6 and 4.4 do not render identically', () => {
    // Compared with toBeCloseTo: these are floating-point subtractions, and
    // asserting the exact bit pattern of 4.6 - 4 tests IEEE 754, not us.
    const high = starFractions(4.6);
    expect(high.slice(0, 4)).toEqual([1, 1, 1, 1]);
    expect(high[4]).toBeCloseTo(0.6);
    expect(starFractions(4.4)[4]).toBeCloseTo(0.4);
  });

  it('is all-empty at zero and all-full at five', () => {
    expect(starFractions(0)).toEqual([0, 0, 0, 0, 0]);
    expect(starFractions(5)).toEqual([1, 1, 1, 1, 1]);
  });
});

describe('reviewPhotoUrl', () => {
  it('builds a public bucket URL, tolerating a trailing slash on the base', () => {
    const path = '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg';
    expect(reviewPhotoUrl(path, 'https://ref.supabase.co/')).toBe(
      `https://ref.supabase.co/storage/v1/object/public/review-photos/${path}`
    );
  });
});

describe('reviewStatusLabel', () => {
  it('words pending as what it means to an admin', () => {
    expect(reviewStatusLabel('pending')).toBe('Awaiting review');
  });
});
