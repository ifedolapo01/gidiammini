// types/shipping.ts

export type ShippingEtaUnit = 'days' | 'weeks' | 'months';

/** A fee/ETA-only carve-out tied to a parent zone (e.g. a cheaper/faster LGA
 * within an otherwise state-wide zone). Nothing else can differ from the
 * parent — pickup, address, phone, and label are never overridden. */
export interface ShippingZoneException {
  id: string;
  parent_zone_id: string;
  /** Null inherits the parent's own LGA (only valid when the parent is itself LGA-scoped). */
  lga: string | null;
  /** Free text (comma/newline separated); narrows within the effective LGA. */
  places: string | null;
  delivery_fee: number | null;
  delivery_eta_min: number | null;
  delivery_eta_max: number | null;
  delivery_eta_unit: ShippingEtaUnit | null;
  is_active: boolean;
}

export interface ShippingZone {
  id: string;
  name: string;
  /** Canonical Nigerian state name — matches a key in lib/data/nigeria-states-lgas.ts. */
  state: string;
  /** Null = the zone covers the whole state. */
  lga: string | null;
  /** Free text (comma/newline separated); only meaningful when `lga` is set. Null/empty = whole LGA. */
  places: string | null;
  delivery_fee: number;
  pickup_available: boolean;
  pickup_address: string | null;
  contact_phone: string | null;
  delivery_label: string;
  /** True = doorstep delivery (customer provides a street address). False = drop-off
   * only (e.g. a park) — no street address is collected, just state/LGA/district. */
  is_door_delivery: boolean;
  delivery_eta_min: number;
  delivery_eta_max: number;
  delivery_eta_unit: ShippingEtaUnit;
  /** The one "main location" zone — drives the product page's headline delivery estimate. */
  is_primary: boolean;
  is_active: boolean;
  sort_order: number;
  /** Embedded via the shipping_zones -> shipping_zone_exceptions relation. */
  shipping_zone_exceptions?: ShippingZoneException[];
  created_at?: string;
  updated_at?: string;
}
