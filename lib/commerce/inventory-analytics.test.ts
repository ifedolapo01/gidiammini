/**
 * The arithmetic the buying decisions rest on.
 *
 * Heavy on the young-ledger cases, because that is the state this feature
 * ships in and the one where a plausible-looking implementation is most wrong:
 * dividing a week of sales by a 90-day window understates every rate by an
 * order of magnitude, and the resulting reorder point of 0 would quietly tell
 * a shop to buy nothing.
 */
import { describe, it, expect } from 'vitest';
import {
  MIN_CONFIDENT_DAYS,
  daysOfCover,
  daysSince,
  reorderPoint,
  sellThroughRate,
  stockMomentum,
  suggestedOrderQuantity,
  variantInsight,
  velocityPerDay,
  type ReorderPolicy,
  type VariantMovementFacts,
} from './inventory-analytics';

const POLICY: ReorderPolicy = { leadDays: 14, coverDays: 30 };
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-09-06T12:00:00.000Z');

const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

describe('velocityPerDay', () => {
  it('divides by the observed window, not the requested one', () => {
    // 6 units in the 3 days the ledger has existed is 2 a day. Dividing by a
    // 90-day window would say 0.07 and every reorder point built on it would
    // round to nothing.
    expect(velocityPerDay(6, 3)).toBe(2);
  });

  it('survives a ledger that started today', () => {
    // Zero observed days must not divide by zero. Two sales today is two a day.
    expect(velocityPerDay(2, 0)).toBe(2);
    expect(Number.isFinite(velocityPerDay(2, 0))).toBe(true);
  });

  it('is zero when nothing sold', () => {
    expect(velocityPerDay(0, 90)).toBe(0);
  });
});

describe('daysOfCover', () => {
  it('is stock over velocity', () => {
    expect(daysOfCover(20, 2)).toBe(10);
  });

  it('is null rather than Infinity when nothing is selling', () => {
    // "It will last forever" and "it is not moving" are different answers, and
    // a column that mixes them sorts wrongly.
    expect(daysOfCover(20, 0)).toBeNull();
  });
});

describe('sellThroughRate', () => {
  it('measures sold against what was available', () => {
    expect(sellThroughRate(30, 10)).toBe(0.75);
  });

  it('is null when there was nothing to sell', () => {
    expect(sellThroughRate(0, 0)).toBeNull();
  });

  it('treats negative stock as none rather than shrinking the denominator', () => {
    // Oversold rows exist; they must not make the rate exceed 1.
    expect(sellThroughRate(10, -5)).toBe(1);
  });
});

describe('reorderPoint and suggestedOrderQuantity', () => {
  it('covers the lead time plus the buffer', () => {
    // 2/day over 44 days.
    expect(reorderPoint(2, POLICY)).toBe(88);
  });

  it('rounds up — ordering half a unit late is ordering late', () => {
    expect(reorderPoint(0.5, POLICY)).toBe(22);
    expect(reorderPoint(0.01, POLICY)).toBe(1);
  });

  it('is zero for something that does not sell', () => {
    expect(reorderPoint(0, POLICY)).toBe(0);
    expect(suggestedOrderQuantity(0, 0, POLICY)).toBe(0);
  });

  it('suggests only the shortfall', () => {
    expect(suggestedOrderQuantity(50, 2, POLICY)).toBe(38);
    // Already above target: nothing to do.
    expect(suggestedOrderQuantity(120, 2, POLICY)).toBe(0);
  });
});

describe('stockMomentum', () => {
  it('says nothing about a variant with no stock', () => {
    // An empty shelf has not "gone dead" — there was nothing to sell.
    expect(stockMomentum(200, 0, 365)).toBe('unknown');
  });

  it('grades a stocked variant by how long since it sold', () => {
    expect(stockMomentum(3, 10, 365)).toBe('selling');
    expect(stockMomentum(45, 10, 365)).toBe('slow');
    expect(stockMomentum(75, 10, 365)).toBe('stale');
    expect(stockMomentum(120, 10, 365)).toBe('dead');
  });

  it('will not call something dead on a young ledger', () => {
    // Never sold, but the ledger is a week old — that is no evidence at all.
    expect(stockMomentum(null, 10, 7)).toBe('unknown');
    expect(stockMomentum(null, 10, 40)).toBe('dead');
  });
});

describe('daysSince', () => {
  it('counts whole days back', () => {
    expect(daysSince(ago(5), NOW)).toBe(5);
  });

  it('is null for a missing or unparseable timestamp', () => {
    expect(daysSince(null, NOW)).toBeNull();
    expect(daysSince('not a date', NOW)).toBeNull();
  });

  it('never returns a negative for a clock skewed into the future', () => {
    expect(daysSince(new Date(NOW + 5 * DAY).toISOString(), NOW)).toBe(0);
  });
});

describe('variantInsight', () => {
  const facts = (over: Partial<VariantMovementFacts> = {}): VariantMovementFacts => ({
    variantId: 'v1',
    soldUnits: 60,
    stock: 12,
    lastSaleAt: ago(1),
    lastRestockAt: ago(20),
    observedDays: 30,
    ...over,
  });

  it('flags a fast-moving line that is about to run out', () => {
    const insight = variantInsight(facts(), POLICY, NOW);

    expect(insight.velocity).toBe(2);
    expect(insight.daysOfCover).toBe(6);
    expect(insight.needsReorder).toBe(true);
    expect(insight.suggestedOrder).toBe(76);
    expect(insight.momentum).toBe('selling');
    expect(insight.confident).toBe(true);
  });

  it('never asks a shop to reorder something that does not sell', () => {
    // Low stock and no demand is a clearance problem, not a buying one. This
    // is the case a naive "stock <= reorderPoint" gets wrong: both are 0.
    const insight = variantInsight(facts({ soldUnits: 0, stock: 0, lastSaleAt: null }), POLICY, NOW);

    expect(insight.velocity).toBe(0);
    expect(insight.reorderPoint).toBe(0);
    expect(insight.needsReorder).toBe(false);
  });

  it('marks a young ledger as not confident', () => {
    const insight = variantInsight(facts({ observedDays: MIN_CONFIDENT_DAYS - 1 }), POLICY, NOW);

    expect(insight.confident).toBe(false);
    // The numbers are still produced — the UI caveats them rather than hiding
    // them, because "we cannot say yet" is itself useful and a blank cell is not.
    expect(insight.velocity).toBeGreaterThan(0);
    expect(insight.observedDays).toBe(MIN_CONFIDENT_DAYS - 1);
  });

  it('reports dead stock with money still tied up in it', () => {
    const insight = variantInsight(
      facts({ soldUnits: 0, stock: 40, lastSaleAt: ago(140), observedDays: 200 }),
      POLICY,
      NOW
    );

    expect(insight.momentum).toBe('dead');
    expect(insight.daysSinceLastSale).toBe(140);
    expect(insight.daysOfCover).toBeNull();
    expect(insight.needsReorder).toBe(false);
  });
});
