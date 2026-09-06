/**
 * COMMERCE layer — settings shapes, defaults and row mapping. Pure.
 *
 * Separate from store-settings-server.ts (which is `server-only` and does the
 * cached read) so the defaults and the mapping can be imported by a client
 * component, and tested without a Supabase client.
 *
 * THE DEFAULTS ARE NOT DECORATION
 *
 * Every consumer of a setting reaches it through a read that can fail — an
 * unapplied migration, a deleted row, a database that is briefly unreachable.
 * The answer to that is never "render nothing"; the shop still has to be able
 * to take an order. So the defaults below are exactly the values that were
 * hardcoded before this table existed, which makes a failed settings read
 * behave precisely like the code did last week rather than like a new bug.
 */

import type { PublicStoreSettings, StoreSettings, StoreSettingsInput } from '@/types/settings';

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: 'GidiamMini',
  supportEmail: null,
  contactPhone: null,
  bankName: null,
  bankAccountName: null,
  bankAccountNumber: null,
  bankSortCode: null,
  // Was TAX_RATE in lib/commerce/checkout.ts.
  taxRate: 0.075,
  // Off. A threshold arriving with a value would change what people are
  // charged the moment this deploys, which is not a default's job.
  freeShippingThreshold: 0,
  // Was the default argument of getStockStatus(), and the literal in three
  // other places.
  lowStockThreshold: 5,
  // Was the literal inside reserve_order_number().
  orderNumberPrefix: 'UT',
  // Two weeks from order to shelf, a month of cover on top — what a shop
  // buying locally would recognise. Both non-zero: a lead time of 0 makes
  // every reorder point 0 and silently disables the suggestion.
  reorderLeadDays: 14,
  reorderCoverDays: 30,
  notifyOrderReceived: true,
  notifyStatusChange: true,
  notifySms: true,
  notifyMarketing: true,
  updatedAt: null,
  updatedBy: null,
};

/** A `numeric` column can arrive as a string from PostgREST. Anything that is
 *  not a finite number — a string that will not parse, a null from a row that
 *  predates the column — falls back rather than poisoning a price with NaN. */
function num(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed === '' ? null : trimmed;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * The shopper-facing half of a store_settings_public row.
 *
 * Takes `any` because it is fed by both the view and the base table, whose
 * generated row types differ by the columns the view drops.
 */
export function publicSettingsFromRow(row: any): PublicStoreSettings {
  const d = DEFAULT_STORE_SETTINGS;
  if (!row) return toPublicSettings(d);

  return {
    storeName: text(row.store_name) ?? d.storeName,
    supportEmail: text(row.support_email),
    contactPhone: text(row.contact_phone),
    bankName: text(row.bank_name),
    bankAccountName: text(row.bank_account_name),
    bankAccountNumber: text(row.bank_account_number),
    bankSortCode: text(row.bank_sort_code),
    taxRate: num(row.tax_rate, d.taxRate),
    freeShippingThreshold: Math.max(0, Math.round(num(row.free_shipping_threshold, d.freeShippingThreshold))),
    lowStockThreshold: Math.max(0, Math.round(num(row.low_stock_threshold, d.lowStockThreshold))),
  };
}

/** The whole row, for the Admin. */
export function settingsFromRow(row: any): StoreSettings {
  const d = DEFAULT_STORE_SETTINGS;
  if (!row) return d;

  return {
    ...publicSettingsFromRow(row),
    orderNumberPrefix: text(row.order_number_prefix) ?? d.orderNumberPrefix,
    reorderLeadDays: Math.max(0, Math.round(num(row.reorder_lead_days, d.reorderLeadDays))),
    reorderCoverDays: Math.max(0, Math.round(num(row.reorder_cover_days, d.reorderCoverDays))),
    notifyOrderReceived: bool(row.notify_order_received, d.notifyOrderReceived),
    notifyStatusChange: bool(row.notify_status_change, d.notifyStatusChange),
    notifySms: bool(row.notify_sms, d.notifySms),
    notifyMarketing: bool(row.notify_marketing, d.notifyMarketing),
    updatedAt: text(row.updated_at),
    updatedBy: text(row.updated_by),
  };
}

/** Narrows the admin shape to what may cross to a shopper's browser. Used by
 *  the root layout, so a setting added to StoreSettings does not become public
 *  merely by existing. */
export function toPublicSettings(settings: StoreSettings): PublicStoreSettings {
  return {
    storeName: settings.storeName,
    supportEmail: settings.supportEmail,
    contactPhone: settings.contactPhone,
    bankName: settings.bankName,
    bankAccountName: settings.bankAccountName,
    bankAccountNumber: settings.bankAccountNumber,
    bankSortCode: settings.bankSortCode,
    taxRate: settings.taxRate,
    freeShippingThreshold: settings.freeShippingThreshold,
    lowStockThreshold: settings.lowStockThreshold,
  };
}

/** Maps the Settings form back onto column names for the UPDATE. */
export function settingsToRow(input: StoreSettingsInput) {
  return {
    store_name: input.storeName.trim(),
    support_email: text(input.supportEmail),
    contact_phone: text(input.contactPhone),
    bank_name: text(input.bankName),
    bank_account_name: text(input.bankAccountName),
    bank_account_number: text(input.bankAccountNumber),
    bank_sort_code: text(input.bankSortCode),
    tax_rate: input.taxRate,
    free_shipping_threshold: input.freeShippingThreshold,
    low_stock_threshold: input.lowStockThreshold,
    order_number_prefix: input.orderNumberPrefix.trim().toUpperCase(),
    reorder_lead_days: input.reorderLeadDays,
    reorder_cover_days: input.reorderCoverDays,
    notify_order_received: input.notifyOrderReceived,
    notify_status_change: input.notifyStatusChange,
    notify_sms: input.notifySms,
    notify_marketing: input.notifyMarketing,
  };
}

/**
 * The delivery fee actually charged, once the free-delivery offer is applied.
 *
 * Here rather than inside getDeliveryFee() because the zone lookup answers
 * "what does delivery to this address cost" and this answers "what is this
 * customer being charged" — the second needs the basket, and only the pricing
 * authority and the cart summary have it.
 *
 * A threshold of 0 disables the offer outright rather than making every order
 * free, which is the reading a zero would otherwise invite.
 */
export function applyFreeShipping(fee: number, subtotal: number, threshold: number): number {
  if (threshold <= 0) return fee;
  return subtotal >= threshold ? 0 : fee;
}
