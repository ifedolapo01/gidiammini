/** ADMIN layer — the discount form's draft shape and its blank state.
 *
 * Apart from useDiscounts.ts, which holds the writes, following the
 * useShippingZones.types.ts convention already in this folder. Every numeric
 * field is text here because it is a field somebody is halfway through typing.
 */
import type { DiscountType } from '@/lib/commerce/discounts';

export interface DiscountFormData {
  name: string;
  type: DiscountType;
  /** Text, not a number: the field is one an owner is halfway through typing.
   *  Ignored entirely for FREE_SHIPPING, whose amount is whatever the zone
   *  charges. */
  value: string;
  scope: 'SITEWIDE' | 'CATEGORY' | 'SUBCATEGORY' | 'PRODUCT' | 'VARIANT';
  target_id: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
  /** Blank means the discount applies automatically to everyone, which is how
   *  every discount behaved before codes existed. */
  code: string;
  /** Blank means unlimited, matching the nullable columns behind them. */
  max_redemptions: string;
  per_customer_limit: string;
  min_order_value: string;
}

export const emptyFormData: DiscountFormData = {
  name: '',
  type: 'PERCENTAGE',
  value: '',
  scope: 'SITEWIDE',
  target_id: '',
  is_active: true,
  start_date: '',
  end_date: '',
  // All blank: a new discount is automatic and unlimited unless the owner says
  // otherwise, which is the behaviour every existing discount already has.
  code: '',
  max_redemptions: '',
  per_customer_limit: '',
  min_order_value: '',
};

/** The nullable numeric fields, as the API wants them. Blank is null, not 0 —
 *  the columns treat null as "no limit" and 0 as "nobody may use this". */
export function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}
