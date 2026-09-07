/**
 * COMMERCE layer (pure) — promised vs. actual delivery, per zone.
 *
 * The zone model computes a real delivery-date promise now (see
 * lib/commerce/delivery-promise.ts), but a promise nobody checks isn't a
 * promise. This is the other half: for every order that reached 'delivered',
 * compare the date it actually got there — read from order_status_history,
 * the only place a 'delivered' timestamp exists — against the window it was
 * promised at checkout, and roll that up per zone the same way
 * revenue-breakdown.ts's revenueByZone already rolls up revenue.
 */

export interface DeliveryPerformanceOrder {
  id: string;
  shipping_zone_id: string | null;
  selected_state: string | null;
  promised_delivery_end: string | null;
}

export interface ZoneDeliveryPerformance {
  zoneId: string | null;
  label: string;
  delivered: number;
  onTime: number;
  late: number;
  lateRate: number;
  /** Mean of (actual date - promised end date) across the late orders only —
   *  0 when nothing was late. */
  avgDaysLate: number;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso.slice(0, 10) + 'T00:00:00Z');
  const to = Date.parse(toIso.slice(0, 10) + 'T00:00:00Z');
  return Math.round((to - from) / 86_400_000);
}

export function deliveryPerformanceByZone(
  orders: DeliveryPerformanceOrder[],
  deliveredAt: Map<string, string>,
  zoneNames: Map<string, string>
): ZoneDeliveryPerformance[] {
  const totals = new Map<
    string,
    { zoneId: string | null; label: string; delivered: number; late: number; daysLateSum: number }
  >();

  for (const order of orders) {
    const actual = deliveredAt.get(order.id);
    // Only orders where both a promise and an actual delivery date exist can
    // be judged — pickup orders and pre-migration orders carry neither.
    if (!actual || !order.promised_delivery_end) continue;

    const zoneId = order.shipping_zone_id;
    const label = (zoneId && zoneNames.get(zoneId)) || order.selected_state?.trim() || 'Unknown';
    const key = zoneId ?? `state:${label}`;

    const entry = totals.get(key) ?? { zoneId, label, delivered: 0, late: 0, daysLateSum: 0 };
    entry.delivered += 1;

    const daysLate = daysBetween(order.promised_delivery_end, actual);
    if (daysLate > 0) {
      entry.late += 1;
      entry.daysLateSum += daysLate;
    }

    totals.set(key, entry);
  }

  return [...totals.values()]
    .map((entry) => ({
      zoneId: entry.zoneId,
      label: entry.label,
      delivered: entry.delivered,
      onTime: entry.delivered - entry.late,
      late: entry.late,
      lateRate: entry.delivered > 0 ? entry.late / entry.delivered : 0,
      avgDaysLate: entry.late > 0 ? entry.daysLateSum / entry.late : 0,
    }))
    .sort((a, b) => b.lateRate - a.lateRate);
}
