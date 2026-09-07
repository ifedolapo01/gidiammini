/**
 * recommendSize resolves an age/height answer against the real SIZE_CHARTS
 * tables, so these pin the two things a wrong answer would break silently:
 * that eligibility follows the resolved chart (not the raw sizing_type
 * field), and that a band this product doesn't stock falls back to the
 * nearest one it does rather than recommending something unbuyable.
 */
import { describe, it, expect } from 'vitest';
import { recommendSize, shouldOfferSizeRecommendation } from './size-recommendation';

const BABY_PRODUCT = {
  sizing_type: 'age' as const,
  category: 'baby',
  sizes: ['0-3 months', '3-6 months', '6-9 months', '9-12 months'],
};

const KIDS_PRODUCT = {
  sizing_type: 'age' as const,
  category: 'kids',
  sizes: ['2-3 years', '4-5 years', '6-7 years'],
};

const LETTER_PRODUCT = {
  sizing_type: 'size' as const,
  category: 'boys',
  sizes: ['S', 'M', 'L'],
};

const MATERNITY_PRODUCT = {
  sizing_type: 'maternity' as const,
  category: 'maternity',
  sizes: ['S', 'M', 'L'],
};

describe('shouldOfferSizeRecommendation', () => {
  it('is true for the age-banded baby and kids charts', () => {
    expect(shouldOfferSizeRecommendation(BABY_PRODUCT)).toBe(true);
    expect(shouldOfferSizeRecommendation(KIDS_PRODUCT)).toBe(true);
  });

  it('is false for letter and maternity charts', () => {
    expect(shouldOfferSizeRecommendation(LETTER_PRODUCT)).toBe(false);
    expect(shouldOfferSizeRecommendation(MATERNITY_PRODUCT)).toBe(false);
  });

  it('follows the resolved chart rather than a stale sizing_type field', () => {
    // sizing_type never switched from 'size', but the sizes are plainly ages —
    // chartForProduct resolves this to the kids table, so the questionnaire
    // must too.
    const legacy = { sizing_type: 'size' as const, category: 'boys', sizes: ['4-5 years', '6-7 years'] };
    expect(shouldOfferSizeRecommendation(legacy)).toBe(true);
  });
});

describe('recommendSize — age', () => {
  it('recommends the stocked band the age falls in', () => {
    const result = recommendSize(BABY_PRODUCT, { ageMonths: 4 });
    expect(result).toEqual({ recommendedSize: '3-6 months', idealLabel: '3-6 months', exactMatch: true });
  });

  it('falls back to the nearest stocked band when the ideal one is missing', () => {
    const sparse = { ...BABY_PRODUCT, sizes: ['0-3 months', '9-12 months'] };
    // 4 months old ideally wants "3-6 months" (not stocked) — "0-3 months" is
    // one band away, "9-12 months" is two, so the nearer one wins.
    const result = recommendSize(sparse, { ageMonths: 4 });
    expect(result).toEqual({ recommendedSize: '0-3 months', idealLabel: '3-6 months', exactMatch: false });
  });

  it('clamps an age above the chart to its last band, then falls back to what is stocked', () => {
    const result = recommendSize(BABY_PRODUCT, { ageMonths: 36 });
    // Ideal is the chart's last band (18-24 months); the product only stocks
    // up to 9-12 months, so that is the nearest fallback.
    expect(result?.idealLabel).toBe('18-24 months');
    expect(result?.recommendedSize).toBe('9-12 months');
  });

  it('works for the kids years chart', () => {
    const result = recommendSize(KIDS_PRODUCT, { ageMonths: 54 });
    expect(result).toEqual({ recommendedSize: '4-5 years', idealLabel: '4-5 years', exactMatch: true });
  });
});

describe('recommendSize — height and weight', () => {
  it('recommends the band a height falls in', () => {
    // 60cm sits inside the "3-6 months" height range (58-66cm).
    const result = recommendSize(BABY_PRODUCT, { heightCm: 60 });
    expect(result?.idealLabel).toBe('3-6 months');
  });

  it('lets weight pull the recommendation up to the larger band on disagreement', () => {
    // 57cm alone points at "0-3 months" (50-58cm), but 6.5kg sits inside the
    // "3-6 months" weight range (5.5-7.5kg) — the chart's own note says to
    // choose the larger band when in doubt, so weight wins here.
    const result = recommendSize(BABY_PRODUCT, { heightCm: 57, weightKg: 6.5 });
    expect(result?.idealLabel).toBe('3-6 months');
  });

  it('keeps the height band when weight disagrees toward a smaller one', () => {
    // 66cm points at "6-9 months"; a low weight (6kg, "3-6 months") should not
    // pull the recommendation down.
    const result = recommendSize(BABY_PRODUCT, { heightCm: 66, weightKg: 6 });
    expect(result?.idealLabel).toBe('6-9 months');
  });
});

describe('recommendSize — no answer', () => {
  it('returns null for letter and maternity charts', () => {
    expect(recommendSize(LETTER_PRODUCT, { ageMonths: 60 })).toBeNull();
    expect(recommendSize(MATERNITY_PRODUCT, { heightCm: 160 })).toBeNull();
  });

  it('returns null when neither age nor height was given', () => {
    expect(recommendSize(BABY_PRODUCT, {})).toBeNull();
  });

  it('returns null when the product has no sizes at all', () => {
    expect(recommendSize({ ...BABY_PRODUCT, sizes: [] }, { ageMonths: 4 })).toBeNull();
  });
});
