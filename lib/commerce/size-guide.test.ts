/**
 * Choosing a size chart, and matching a product's own sizes onto it.
 *
 * Both are about the same underlying problem: product sizes are free text
 * typed into an admin form, so "0-3 months", "0-3M" and "0 - 3 mths" are one
 * band written three ways. Every one of these cases came from what the size
 * facet already has to cope with (see size-order.ts) — the two modules read
 * the same messy strings.
 */
import { describe, it, expect } from 'vitest';
import {
  chartForProduct,
  fitAdvice,
  fitLabel,
  isFitRating,
  matchedChartRows,
  sizeSelectorLabel,
} from './size-guide';
import { SIZE_CHARTS } from '@/lib/data/size-charts';

describe('chartForProduct', () => {
  it('gives baby stock the baby table', () => {
    const chart = chartForProduct({ sizing_type: 'age', sizes: ['0-3 months', '3-6 months'] });
    expect(chart.id).toBe('baby');
  });

  it('gives kids stock the kids table, from the same sizing_type', () => {
    // The distinction the sizing_type alone cannot make: both say 'age'.
    const chart = chartForProduct({ sizing_type: 'age', sizes: ['5-6 years', '7-8 years'] });
    expect(chart.id).toBe('kids');
  });

  it('treats a product spanning months and years as baby stock', () => {
    // "18-24 months" to "3 years" is a baby product with a top end, and the
    // baby table's last row covers it.
    const chart = chartForProduct({ sizing_type: 'age', sizes: ['18-24 months', '3 years'] });
    expect(chart.id).toBe('baby');
  });

  it('gives letter sizes the letter table', () => {
    expect(chartForProduct({ sizing_type: 'size', sizes: ['S', 'M', 'L'] }).id).toBe('letter');
  });

  it('uses the maternity table when the sizing type says so', () => {
    expect(chartForProduct({ sizing_type: 'maternity', sizes: ['S', 'M'] }).id).toBe('maternity');
  });

  it('falls back to maternity for a maternity product whose type was never set', () => {
    // Every existing maternity row predates the 'maternity' sizing type, and
    // none of them should show a children's chart until somebody edits them.
    expect(chartForProduct({ sizing_type: 'size', category: 'maternity', sizes: ['S', 'M'] }).id).toBe(
      'maternity'
    );
    expect(chartForProduct({ sizing_type: null, category: 'maternity', sizes: [] }).id).toBe('maternity');
  });

  it('does not hijack a maternity-category product that really is age-sized', () => {
    // A nursing set sold in baby sizes, say. An explicit 'age' wins.
    expect(
      chartForProduct({ sizing_type: 'age', category: 'maternity', sizes: ['0-3 months'] }).id
    ).toBe('baby');
  });

  it('reads plain age bands typed under the wrong sizing type', () => {
    // The admin never switched the toggle, but the sizes say what they are.
    expect(chartForProduct({ sizing_type: 'size', sizes: ['0-3 months', '3-6 months'] }).id).toBe('baby');
    expect(chartForProduct({ sizing_type: 'size', sizes: ['2-3 years', '4-5 years'] }).id).toBe('kids');
  });

  it('always returns a chart, even with no sizes at all', () => {
    expect(chartForProduct({}).id).toBe('letter');
    expect(chartForProduct({ sizing_type: 'age', sizes: [] }).id).toBe('kids');
  });
});

describe('matchedChartRows', () => {
  const baby = SIZE_CHARTS.baby;

  it('matches a band written the long way', () => {
    expect(matchedChartRows(baby, ['0-3 months'])).toEqual(new Set(['0-3 months']));
  });

  it('matches the abbreviations an admin actually types', () => {
    const matched = matchedChartRows(baby, ['0-3M', '3-6m', '6-9 mths', '9-12 Months']);
    expect(matched).toEqual(
      new Set(['0-3 months', '3-6 months', '6-9 months', '9-12 months'])
    );
  });

  it('tolerates spaces around the dash', () => {
    expect(matchedChartRows(baby, ['0 - 3 months'])).toEqual(new Set(['0-3 months']));
  });

  it('matches newborn and 2T, which are labelled differently from the rest', () => {
    expect(matchedChartRows(baby, ['Newborn', 'NB'])).toEqual(new Set(['Newborn']));
    expect(matchedChartRows(baby, ['2T'])).toEqual(new Set(['18-24 months']));
  });

  it('matches letter sizes case-insensitively', () => {
    expect(matchedChartRows(SIZE_CHARTS.letter, ['s', 'XL'])).toEqual(new Set(['S', 'XL']));
  });

  it('returns nothing for a size the chart has no row for, rather than guessing', () => {
    expect(matchedChartRows(baby, ['One size', ''])).toEqual(new Set());
  });

  it('does not mistake M for a month band', () => {
    // "m" is Medium; only a number in front of it makes it months.
    expect(matchedChartRows(SIZE_CHARTS.letter, ['M'])).toEqual(new Set(['M']));
    expect(chartForProduct({ sizing_type: 'size', sizes: ['M'] }).id).toBe('letter');
  });
});

describe('fit rating', () => {
  it('says what the rating is and what to do about it', () => {
    expect(fitLabel('runs_small')).toBe('Runs small');
    expect(fitAdvice('runs_small')).toMatch(/next size up/i);
    expect(fitAdvice('runs_large')).toMatch(/next size down/i);
  });

  it('recognises only the three ratings the column allows', () => {
    expect(isFitRating('true_to_size')).toBe(true);
    expect(isFitRating('runs_narrow')).toBe(false);
    expect(isFitRating(null)).toBe(false);
    expect(isFitRating(undefined)).toBe(false);
  });
});

describe('sizeSelectorLabel', () => {
  it('says Age only for age-sized products', () => {
    expect(sizeSelectorLabel('age')).toBe('Age');
    expect(sizeSelectorLabel('size')).toBe('Size');
    expect(sizeSelectorLabel('maternity')).toBe('Size');
    expect(sizeSelectorLabel(null)).toBe('Size');
  });
});
