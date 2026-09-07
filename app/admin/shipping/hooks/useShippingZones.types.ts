/** ADMIN layer — form-data shape for the shipping zone modal, split out of
 * useShippingZones.ts to keep that file under the project's line-count cap. */

import type { ShippingEtaUnit } from '@/types/shipping';
import { NIGERIA_STATE_NAMES } from '@/lib/data/nigeria-states-lgas';

export interface ShippingZoneFormData {
  name: string;
  state: string;
  lga: string;
  places: string;
  delivery_fee: string;
  pickup_available: boolean;
  pickup_address: string;
  contact_phone: string;
  delivery_label: string;
  is_door_delivery: boolean;
  delivery_eta_min: string;
  delivery_eta_max: string;
  delivery_eta_unit: ShippingEtaUnit;
  /** "HH:MM" (24h), or '' for no cutoff. */
  order_cutoff_time: string;
  /** ISO weekday numbers (1=Monday .. 7=Sunday). */
  working_days: number[];
  is_primary: boolean;
  is_active: boolean;
  sort_order: string;
}

export const emptyFormData: ShippingZoneFormData = {
  name: '',
  state: NIGERIA_STATE_NAMES[0],
  lga: '',
  places: '',
  delivery_fee: '',
  pickup_available: false,
  pickup_address: '',
  contact_phone: '',
  delivery_label: 'Delivery',
  is_door_delivery: true,
  delivery_eta_min: '',
  delivery_eta_max: '',
  delivery_eta_unit: 'days',
  order_cutoff_time: '',
  working_days: [1, 2, 3, 4, 5, 6],
  is_primary: false,
  is_active: true,
  sort_order: '0',
};
