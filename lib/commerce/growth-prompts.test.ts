/**
 * findGrowthPrompt turns a customer's past order lines into at most one
 * "probably grown out of it" card. These pin the three ways it must stay
 * honest: silent for non-age-banded sizes, silent for the last band in a
 * chart (there is no "next" size to suggest), and silent until roughly half
 * of the bought band's own width has plausibly passed.
 */
import { describe, it, expect } from 'vitest';
import { findGrowthPrompt, type GrowthPromptLine } from './growth-prompts';

const NOW = new Date('2026-06-15T00:00:00Z');

function line(overrides: Partial<GrowthPromptLine>): GrowthPromptLine {
  return {
    sizing_type: 'age',
    category: 'baby',
    size: '0-3 months',
    createdAt: '2026-06-01T00:00:00Z',
    productName: 'Sleepsuit',
    ...overrides,
  };
}

describe('findGrowthPrompt', () => {
  it('suggests the next band once enough of the current band has plausibly passed', () => {
    // "0-3 months" is 3 months wide, so the threshold is 1.5 months; this
    // order is 2 calendar months old.
    const prompt = findGrowthPrompt([line({ createdAt: '2026-04-15T00:00:00Z' })], NOW);
    expect(prompt).toEqual({
      productName: 'Sleepsuit',
      boughtSize: '0-3 months',
      boughtDate: '2026-04-15T00:00:00Z',
      suggestedNextSize: '3-6 months',
      monthsElapsed: 2,
    });
  });

  it('stays silent before the threshold', () => {
    // Only 1 calendar month has passed, under the 1.5-month threshold.
    const prompt = findGrowthPrompt([line({ createdAt: '2026-05-15T00:00:00Z' })], NOW);
    expect(prompt).toBeNull();
  });

  it('is silent for the last band in its chart — nothing bigger to suggest', () => {
    const prompt = findGrowthPrompt(
      [line({ size: '18-24 months', createdAt: '2025-01-01T00:00:00Z' })],
      NOW
    );
    expect(prompt).toBeNull();
  });

  it('is silent for sizing that is not age/height-banded', () => {
    const prompt = findGrowthPrompt(
      [line({ sizing_type: 'size', category: 'boys', size: 'M', createdAt: '2025-01-01T00:00:00Z' })],
      NOW
    );
    expect(prompt).toBeNull();
  });

  it('is silent for maternity sizing', () => {
    const prompt = findGrowthPrompt(
      [line({ sizing_type: 'maternity', category: 'maternity', size: 'M', createdAt: '2025-01-01T00:00:00Z' })],
      NOW
    );
    expect(prompt).toBeNull();
  });

  it('ignores a line with no size recorded', () => {
    const prompt = findGrowthPrompt([line({ size: null, createdAt: '2025-01-01T00:00:00Z' })], NOW);
    expect(prompt).toBeNull();
  });

  it('picks the most recently bought qualifying line over an older one', () => {
    const prompt = findGrowthPrompt(
      [
        line({ productName: 'Old romper', size: '0-3 months', createdAt: '2026-01-01T00:00:00Z' }),
        line({ productName: 'New romper', size: '3-6 months', createdAt: '2026-04-01T00:00:00Z' }),
      ],
      NOW
    );
    expect(prompt?.productName).toBe('New romper');
    expect(prompt?.suggestedNextSize).toBe('6-9 months');
  });

  it('returns null for an empty history', () => {
    expect(findGrowthPrompt([], NOW)).toBeNull();
  });
});
