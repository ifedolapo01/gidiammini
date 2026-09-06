/** ADMIN layer — the Settings form's draft shape, and the two conversions
 *  either side of it. Pure, so the number handling can be reasoned about
 *  without a component or a fetch in the way.
 *
 *  Numbers are text in the draft and numbers on the wire. See the header of
 *  useStoreSettingsForm.ts for why.
 */

import type { FieldErrors } from '@/lib/api/field-errors';
import type { StoreSettings, StoreSettingsInput } from '@/types/settings';

export interface SettingsDraft {
  storeName: string;
  supportEmail: string;
  contactPhone: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankSortCode: string;
  /** As a percentage, the way it is written on an invoice — "7.5", not "0.075". */
  taxPercent: string;
  freeShippingThreshold: string;
  lowStockThreshold: string;
  orderNumberPrefix: string;
  reorderLeadDays: string;
  reorderCoverDays: string;
  notifyOrderReceived: boolean;
  notifyStatusChange: boolean;
  notifySms: boolean;
  notifyMarketing: boolean;
}

export function toDraft(settings: StoreSettings): SettingsDraft {
  return {
    storeName: settings.storeName,
    supportEmail: settings.supportEmail ?? '',
    contactPhone: settings.contactPhone ?? '',
    bankName: settings.bankName ?? '',
    bankAccountName: settings.bankAccountName ?? '',
    bankAccountNumber: settings.bankAccountNumber ?? '',
    bankSortCode: settings.bankSortCode ?? '',
    // toFixed(3) then trimmed of trailing zeros: 0.075 must render as "7.5",
    // not as "7.500000000000001", which is what multiplying a float by 100
    // gives you often enough to matter.
    taxPercent: String(Number((settings.taxRate * 100).toFixed(3))),
    freeShippingThreshold: String(settings.freeShippingThreshold),
    lowStockThreshold: String(settings.lowStockThreshold),
    orderNumberPrefix: settings.orderNumberPrefix,
    reorderLeadDays: String(settings.reorderLeadDays),
    reorderCoverDays: String(settings.reorderCoverDays),
    notifyOrderReceived: settings.notifyOrderReceived,
    notifyStatusChange: settings.notifyStatusChange,
    notifySms: settings.notifySms,
    notifyMarketing: settings.notifyMarketing,
  };
}

export type PayloadResult =
  | { ok: true; data: StoreSettingsInput }
  | { ok: false; fieldErrors: FieldErrors };

/** A whole number from a text field, or null if it is not one. Blank counts as
 *  zero — an owner clearing "free delivery over" means they are turning it
 *  off, not that they have left the field in an invalid state. */
function wholeNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return 0;
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * The draft as the request body, or the fields that stopped it.
 *
 * Duplicates the server's rules on purpose — the server is still the authority
 * and re-checks everything, but a form that only finds out a value is wrong
 * after a round trip is a form that feels broken on a slow connection.
 */
export function toPayload(draft: SettingsDraft): PayloadResult {
  const fieldErrors: FieldErrors = {};

  if (draft.storeName.trim() === '') {
    fieldErrors.storeName = 'Store name is required.';
  }

  const percent = Number(draft.taxPercent.trim() === '' ? '0' : draft.taxPercent);
  if (!Number.isFinite(percent)) {
    fieldErrors.taxRate = 'The tax rate must be a number.';
  } else if (percent < 0 || percent > 100) {
    fieldErrors.taxRate = 'The tax rate must be between 0 and 100%.';
  }

  const freeShipping = wholeNumber(draft.freeShippingThreshold);
  if (freeShipping === null) {
    fieldErrors.freeShippingThreshold = 'Enter a whole number of naira, or 0 to turn the offer off.';
  }

  const lowStock = wholeNumber(draft.lowStockThreshold);
  if (lowStock === null) {
    fieldErrors.lowStockThreshold = 'Enter a whole number.';
  } else if (lowStock > 1000) {
    fieldErrors.lowStockThreshold = 'A low-stock threshold above 1000 would flag the whole catalogue.';
  }

  const leadDays = wholeNumber(draft.reorderLeadDays);
  if (leadDays === null || leadDays > 365) {
    fieldErrors.reorderLeadDays = 'Enter a whole number of days, up to 365.';
  }

  const coverDays = wholeNumber(draft.reorderCoverDays);
  if (coverDays === null || coverDays > 365) {
    fieldErrors.reorderCoverDays = 'Enter a whole number of days, up to 365.';
  }

  const prefix = draft.orderNumberPrefix.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,6}$/.test(prefix)) {
    fieldErrors.orderNumberPrefix = 'Use up to 6 letters and digits, with no spaces.';
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return {
    ok: true,
    data: {
      storeName: draft.storeName.trim(),
      supportEmail: draft.supportEmail.trim() || null,
      contactPhone: draft.contactPhone.trim() || null,
      bankName: draft.bankName.trim() || null,
      bankAccountName: draft.bankAccountName.trim() || null,
      bankAccountNumber: draft.bankAccountNumber.trim() || null,
      bankSortCode: draft.bankSortCode.trim() || null,
      // Back to a fraction, rounded to five decimals to match numeric(6,5).
      // Without the round, 7.5 / 100 is 0.07500000000000001 and the column
      // rejects it.
      taxRate: Number((percent / 100).toFixed(5)),
      freeShippingThreshold: freeShipping!,
      lowStockThreshold: lowStock!,
      orderNumberPrefix: prefix,
      reorderLeadDays: leadDays!,
      reorderCoverDays: coverDays!,
      notifyOrderReceived: draft.notifyOrderReceived,
      notifyStatusChange: draft.notifyStatusChange,
      notifySms: draft.notifySms,
      notifyMarketing: draft.notifyMarketing,
    },
  };
}
