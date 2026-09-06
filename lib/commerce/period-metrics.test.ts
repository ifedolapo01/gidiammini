/**
 * The period figures and their deltas.
 *
 * The cases that matter are the ones where a plausible implementation prints a
 * confident number it has no basis for: a percentage change against zero, an
 * average over no orders, and a repeat rate that counts a shop's first-ever
 * customers as returning.
 */
import { describe, it, expect } from 'vitest';
import {
  comparePeriods,
  deltaBetween,
  summarisePeriod,
  type PeriodOrder,
} from './period-metrics';
import { parseRange, rangeFor, withinRange } from './date-range';

const order = (over: Partial<PeriodOrder> = {}): PeriodOrder => ({
  id: 'o1',
  created_at: '2026-09-02T10:00:00Z',
  status: 'delivered',
  total_amount: 10_000,
  amount_paid: 10_000,
  amount_refunded: 0,
  customer_id: 'c1',
  customer_email: 'ada@example.com',
  ...over,
});

describe('summarisePeriod', () => {
  it('counts money received less refunds, not order totals', () => {
    // The distinction the whole card rests on: an order whose transfer never
    // arrived is not revenue.
    const result = summarisePeriod(
      [
        order({ id: 'a', total_amount: 10_000, amount_paid: 10_000 }),
        order({ id: 'b', total_amount: 50_000, amount_paid: 0 }),
        order({ id: 'c', total_amount: 20_000, amount_paid: 20_000, amount_refunded: 5_000 }),
      ],
      new Set()
    );

    expect(result.revenue).toBe(25_000);
  });

  it('parses numerics that arrive as strings', () => {
    // PostgREST returns numeric as a string often enough that a bare read
    // would concatenate rather than add.
    const result = summarisePeriod([order({ amount_paid: '7500', amount_refunded: '500' })], new Set());
    expect(result.revenue).toBe(7_000);
  });

  it('keeps cancelled orders out of revenue but in the count', () => {
    const result = summarisePeriod(
      [order({ id: 'a' }), order({ id: 'b', status: 'cancelled', amount_paid: 10_000 })],
      new Set()
    );

    expect(result.revenue).toBe(10_000);
    expect(result.orders).toBe(2);
    expect(result.cancelledOrders).toBe(1);
    expect(result.cancellationRate).toBe(0.5);
  });

  it('leaves the average undefined when nothing was paid for', () => {
    // Not zero. An average of no orders does not exist, and printing ₦0 reads
    // as "our orders are worth nothing".
    const result = summarisePeriod([order({ status: 'pending', amount_paid: 0 })], new Set());
    expect(result.averageOrderValue).toBeNull();
  });

  it('counts a customer as returning only if they ordered before the window', () => {
    const result = summarisePeriod(
      [
        order({ id: 'a', customer_id: 'known' }),
        order({ id: 'b', customer_id: 'new-person' }),
      ],
      new Set(['known'])
    );

    expect(result.customers).toBe(2);
    expect(result.repeatCustomerRate).toBe(0.5);
  });

  it('identifies a guest by email when there is no customer row', () => {
    // A guest checkout may have no customer record yet. Without the fallback
    // every guest is anonymous and the repeat rate is wrong in both directions.
    const result = summarisePeriod(
      [order({ id: 'a', customer_id: null, customer_email: 'Ada@Example.com ' })],
      new Set(['ada@example.com'])
    );

    expect(result.repeatCustomerRate).toBe(1);
  });

  it('counts one customer once however many times they ordered', () => {
    const result = summarisePeriod(
      [order({ id: 'a' }), order({ id: 'b' }), order({ id: 'c' })],
      new Set()
    );
    expect(result.customers).toBe(1);
  });

  it('has no repeat rate when nobody identifiable ordered', () => {
    const result = summarisePeriod([], new Set());
    expect(result.repeatCustomerRate).toBeNull();
    expect(result.cancellationRate).toBeNull();
  });
});

describe('deltaBetween', () => {
  it('reports a proportional change', () => {
    expect(deltaBetween(120, 100)).toMatchObject({ change: 0.2, direction: 'up' });
    expect(deltaBetween(80, 100)).toMatchObject({ change: -0.2, direction: 'down' });
  });

  it('refuses to compare against zero', () => {
    // "+∞%" and "+100%" are both lies about a number that did not exist. The
    // UI says "no comparison yet" instead.
    expect(deltaBetween(40, 0)).toBeNull();
  });

  it('refuses to compare against a missing figure', () => {
    expect(deltaBetween(40, null)).toBeNull();
    expect(deltaBetween(null, 40)).toBeNull();
  });

  it('calls a tiny move flat rather than flickering', () => {
    expect(deltaBetween(1002, 1000)?.direction).toBe('flat');
  });
});

describe('comparePeriods', () => {
  it('produces a delta per metric', () => {
    const current = summarisePeriod([order({ id: 'a' }), order({ id: 'b' })], new Set());
    const previous = summarisePeriod([order({ id: 'c' })], new Set());

    const deltas = comparePeriods(current, previous);
    expect(deltas.orders).toMatchObject({ direction: 'up' });
    expect(deltas.revenue).toMatchObject({ direction: 'up' });
  });
});

describe('rangeFor', () => {
  const NOW = new Date('2026-09-06T15:30:00Z');

  it('includes all of today and the previous window ends where this one starts', () => {
    const { current, previous } = rangeFor(7, NOW);

    // Exclusive end is the start of tomorrow, so a morning does not look like
    // a decline against whole days.
    expect(current.to).toBe('2026-09-07T00:00:00.000Z');
    expect(current.from).toBe('2026-08-31T00:00:00.000Z');
    expect(previous.to).toBe(current.from);
    expect(previous.from).toBe('2026-08-24T00:00:00.000Z');
  });

  it('gives both windows the same length', () => {
    const { current, previous } = rangeFor(30, NOW);
    const span = (r: { from: string; to: string }) => Date.parse(r.to) - Date.parse(r.from);
    expect(span(current)).toBe(span(previous));
  });

  it('falls back to the default for a value that is not a preset', () => {
    // A bad range in a URL should show the default dashboard, not an error.
    expect(parseRange('999')).toBe(30);
    expect(parseRange(null)).toBe(30);
    expect(parseRange('7')).toBe(7);
  });

  it('treats the exclusive end as outside the window', () => {
    const { current } = rangeFor(7, NOW);
    expect(withinRange(current.from, current)).toBe(true);
    expect(withinRange(current.to, current)).toBe(false);
  });
});
