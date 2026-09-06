/**
 * Where the money came from.
 *
 * The cases worth pinning are the ones where a row would otherwise vanish: a
 * product with no category, and an order whose shipping zone has since been
 * deleted. A breakdown that silently drops rows makes its own total wrong and
 * gives nobody a way to see why.
 */
import { describe, it, expect } from 'vitest';
import { revenueByCategory, revenueByZone } from './revenue-breakdown';

describe('revenueByCategory', () => {
  it('sums line value per category and ranks by revenue', () => {
    const rows = revenueByCategory([
      { category: 'kids', price: 5_000, quantity: 2 },
      { category: 'babies', price: 30_000, quantity: 1 },
      { category: 'kids', price: 5_000, quantity: 1 },
    ]);

    expect(rows[0]).toMatchObject({ category: 'babies', revenue: 30_000, units: 1 });
    expect(rows[1]).toMatchObject({ category: 'kids', revenue: 15_000, units: 3 });
  });

  it('shares sum to the whole', () => {
    const rows = revenueByCategory([
      { category: 'a', price: 100, quantity: 1 },
      { category: 'b', price: 300, quantity: 1 },
    ]);

    expect(rows.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1, 10);
    expect(rows[0].share).toBeCloseTo(0.75, 10);
  });

  it('names uncategorised revenue rather than dropping it', () => {
    // Dropping it would make the panel's own total disagree with the revenue
    // card above it, with nothing on screen explaining the gap.
    const rows = revenueByCategory([
      { category: null, price: 1_000, quantity: 1 },
      { category: '   ', price: 500, quantity: 1 },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: 'Uncategorised', revenue: 1_500 });
  });

  it('survives a period with no sales', () => {
    expect(revenueByCategory([])).toEqual([]);
  });
});

describe('revenueByZone', () => {
  const zones = new Map([
    ['z1', 'Lagos Mainland'],
    ['z2', 'Abuja'],
  ]);

  it('groups by zone and reports delivery charged beside revenue', () => {
    // The pairing that makes a courier negotiation possible: a zone worth the
    // same as another but costing far more to serve is a different decision.
    const rows = revenueByZone(
      [
        { shipping_zone_id: 'z1', selected_state: 'Lagos', revenue: 40_000, shipping: 2_500 },
        { shipping_zone_id: 'z1', selected_state: 'Lagos', revenue: 20_000, shipping: 2_500 },
        { shipping_zone_id: 'z2', selected_state: 'FCT', revenue: 30_000, shipping: 7_000 },
      ],
      zones
    );

    expect(rows[0]).toMatchObject({
      label: 'Lagos Mainland',
      orders: 2,
      revenue: 60_000,
      shippingCharged: 5_000,
      averageOrderValue: 30_000,
    });
    expect(rows[1]).toMatchObject({ label: 'Abuja', shippingCharged: 7_000 });
  });

  it('falls back to the state when the zone has been deleted', () => {
    // The order still went somewhere. Dropping it would understate the total.
    const rows = revenueByZone(
      [{ shipping_zone_id: 'gone', selected_state: 'Ogun', revenue: 12_000, shipping: 3_000 }],
      zones
    );

    expect(rows[0]).toMatchObject({ label: 'Ogun', revenue: 12_000 });
  });

  it('keeps orders with neither zone nor state visible', () => {
    const rows = revenueByZone(
      [{ shipping_zone_id: null, selected_state: null, revenue: 5_000, shipping: 0 }],
      zones
    );

    expect(rows[0]).toMatchObject({ label: 'Unknown', revenue: 5_000 });
  });

  it('does not merge two deleted zones that went to different states', () => {
    const rows = revenueByZone(
      [
        { shipping_zone_id: null, selected_state: 'Ogun', revenue: 1_000, shipping: 0 },
        { shipping_zone_id: null, selected_state: 'Oyo', revenue: 2_000, shipping: 0 },
      ],
      zones
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.label).sort()).toEqual(['Ogun', 'Oyo']);
  });
});
