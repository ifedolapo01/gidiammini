/**
 * COMMERCE layer — narrows values read out of the database to the app's own
 * union types.
 *
 * Postgres enforces the valid values for several columns with CHECK
 * constraints (orders.status, orders.delivery_option, discounts.type,
 * discounts.scope, ...), but a type generator can't read intent out of a
 * CHECK — it can only see `text`. So the generated types say `string` where
 * the app means `OrderStatus`.
 *
 * These helpers close that gap at the read boundary. They validate rather than
 * cast blindly: a bare `as OrderStatus` would hide the one case that actually
 * matters — a value reaching the app that the code has no branch for, e.g.
 * after someone adds a status in SQL without updating ORDER_STATUSES.
 */
import type { OrderStatus } from '@/types/order';
import { ORDER_STATUSES, INITIAL_ORDER_STATUS } from './order-status';
import type { Discount } from './discounts';
import type { ShippingEtaUnit, ShippingZone } from '@/types/shipping';

/** Narrows a stored status string, logging and falling back if it's unknown. */
export function asOrderStatus(value: string | null | undefined): OrderStatus {
  if (value && (ORDER_STATUSES as string[]).includes(value)) {
    return value as OrderStatus;
  }
  console.error(
    `Unknown order status "${value}" read from the database. ` +
    `Falling back to "${INITIAL_ORDER_STATUS}" — add it to ORDER_STATUSES in lib/commerce/order-status.ts.`
  );
  return INITIAL_ORDER_STATUS;
}

/** Narrows a stored delivery option. Delivery is the safer default: it never
 * promises a pickup location the customer can't actually collect from. */
export function asDeliveryOption(value: string | null | undefined): 'pickup' | 'delivery' {
  if (value === 'pickup' || value === 'delivery') return value;
  if (value) console.error(`Unknown delivery_option "${value}" read from the database.`);
  return 'delivery';
}

/** The subset of an order row that the shipping/status helpers need, with the
 * CHECK-constrained columns already narrowed. */
export interface NarrowedOrderFields {
  status: OrderStatus;
  delivery_option: 'pickup' | 'delivery';
}

export function narrowOrderFields<T extends { status: string; delivery_option: string }>(
  row: T
): Omit<T, 'status' | 'delivery_option'> & NarrowedOrderFields {
  return {
    ...row,
    status: asOrderStatus(row.status),
    delivery_option: asDeliveryOption(row.delivery_option),
  };
}

/** `discounts.notified_phases` is jsonb, so it types as Json. It only ever
 * holds an array of phase names — anything else is treated as "none sent". */
export function asNotifiedPhases(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Narrows a discounts row. `type` and `scope` are CHECK-constrained in the
 * database (see 20251101000100 and 20251101000400), so the cast is backed by a
 * constraint rather than a hope. */
export function asDiscount(row: {
  id: string;
  name: string;
  type: string;
  value: number;
  scope: string;
  target_id: string | null;
  is_active: boolean | null;
  start_date: string | null;
  end_date: string | null;
  created_at?: string | null;
}): Discount {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Discount['type'],
    value: row.value,
    scope: row.scope as Discount['scope'],
    target_id: row.target_id,
    is_active: row.is_active ?? false,
    start_date: row.start_date,
    end_date: row.end_date,
    created_at: row.created_at ?? undefined,
  };
}

/** `shipping_zones.delivery_eta_unit` is CHECK-constrained text
 * (see 20251101000700). Days is the safe default: it under-promises rather
 * than quoting a customer a longer window than the admin configured. */
export function asEtaUnit(value: string | null | undefined): ShippingEtaUnit {
  if (value === 'days' || value === 'weeks' || value === 'months') return value;
  if (value) console.error(`Unknown delivery_eta_unit "${value}" read from the database.`);
  return 'days';
}

/** Narrows a shipping_zones row, including its embedded exceptions. */
export function narrowShippingZone(row: any): ShippingZone {
  return {
    ...row,
    delivery_eta_unit: asEtaUnit(row.delivery_eta_unit),
    shipping_zone_exceptions: (row.shipping_zone_exceptions ?? []).map((exception: any) => ({
      ...exception,
      // Null is meaningful on an exception: it inherits the parent's unit.
      delivery_eta_unit: exception.delivery_eta_unit == null ? null : asEtaUnit(exception.delivery_eta_unit),
    })),
  };
}

export function narrowShippingZones(rows: any[] | null | undefined): ShippingZone[] {
  return (rows ?? []).map(narrowShippingZone);
}
