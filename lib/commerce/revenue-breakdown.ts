/**
 * COMMERCE layer — where the money came from. Pure.
 *
 * Two cuts of the same period: by product category, and by shipping zone.
 *
 * THE ZONE CUT IS THE ONE NOBODY ELSE HAS
 *
 * Most shops treat delivery as a flat cost and cannot tell you what any part
 * of the country is worth. This one models zones properly — fees, ETAs,
 * pickup, per-LGA exceptions — so it can put revenue and delivery cost side by
 * side per zone, which is exactly the argument for negotiating a courier rate
 * on the routes that carry the volume. That is why the zone table carries the
 * fee total and not only the revenue: a zone worth ₦2m that costs ₦180k to
 * serve is a different conversation from one worth ₦2m that costs ₦20k.
 *
 * REVENUE IS ATTRIBUTED DIFFERENTLY IN THE TWO CUTS, ON PURPOSE
 *
 * A zone belongs to an order, so the zone cut uses what the order was worth. A
 * category belongs to a line, so the category cut sums line values — an order
 * with a dress and a babygrow splits across two categories rather than landing
 * arbitrarily in one. The two therefore need not total the same figure, and
 * the UI labels them accordingly rather than implying they reconcile.
 */

export interface CategoryRevenueLine {
  category: string | null;
  /** Per unit, as charged. */
  price: number;
  quantity: number;
}

export interface CategoryRevenue {
  category: string;
  revenue: number;
  units: number;
  /** Share of the period's line revenue, 0-1. */
  share: number;
}

/** Anything sold without a category recorded. Named rather than dropped: a
 *  breakdown that silently omits rows makes the total wrong and nobody can see
 *  why. */
const UNCATEGORISED = 'Uncategorised';

export function revenueByCategory(lines: CategoryRevenueLine[]): CategoryRevenue[] {
  const totals = new Map<string, { revenue: number; units: number }>();

  for (const line of lines) {
    const key = line.category?.trim() || UNCATEGORISED;
    const entry = totals.get(key) ?? { revenue: 0, units: 0 };
    entry.revenue += line.price * line.quantity;
    entry.units += line.quantity;
    totals.set(key, entry);
  }

  const total = [...totals.values()].reduce((sum, entry) => sum + entry.revenue, 0);

  return [...totals.entries()]
    .map(([category, entry]) => ({
      category,
      revenue: entry.revenue,
      units: entry.units,
      share: total > 0 ? entry.revenue / total : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export interface ZoneRevenueOrder {
  shipping_zone_id: string | null;
  selected_state: string | null;
  /** Money kept on this order. */
  revenue: number;
  /** What was charged for delivery on it. */
  shipping: number;
}

export interface ZoneRevenue {
  zoneId: string | null;
  /** The zone's name, or the state it went to when the zone is gone. */
  label: string;
  orders: number;
  revenue: number;
  /** Delivery fees charged across those orders. */
  shippingCharged: number;
  /** Revenue per order for this zone — what makes a low-volume, high-basket
   *  zone visible next to a high-volume, low-basket one. */
  averageOrderValue: number;
  share: number;
}

export function revenueByZone(
  orders: ZoneRevenueOrder[],
  zoneNames: Map<string, string>
): ZoneRevenue[] {
  const totals = new Map<
    string,
    { zoneId: string | null; label: string; orders: number; revenue: number; shipping: number }
  >();

  for (const order of orders) {
    // Fall back to the state when a zone has since been deleted: the order
    // still went somewhere, and dropping it would understate the total.
    const zoneId = order.shipping_zone_id;
    const label = (zoneId && zoneNames.get(zoneId)) || order.selected_state?.trim() || 'Unknown';
    const key = zoneId ?? `state:${label}`;

    const entry = totals.get(key) ?? { zoneId, label, orders: 0, revenue: 0, shipping: 0 };
    entry.orders += 1;
    entry.revenue += order.revenue;
    entry.shipping += order.shipping;
    totals.set(key, entry);
  }

  const total = [...totals.values()].reduce((sum, entry) => sum + entry.revenue, 0);

  return [...totals.values()]
    .map((entry) => ({
      zoneId: entry.zoneId,
      label: entry.label,
      orders: entry.orders,
      revenue: entry.revenue,
      shippingCharged: entry.shipping,
      averageOrderValue: entry.orders > 0 ? entry.revenue / entry.orders : 0,
      share: total > 0 ? entry.revenue / total : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}
