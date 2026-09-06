/**
 * The operational settings an owner changes without a deploy.
 *
 * Backed by the singleton public.store_settings row (migration
 * 20260905200000). Two shapes, because two audiences:
 *
 *   StoreSettings        everything, admin-only. Read on the server through
 *                        lib/commerce/store-settings-server.ts.
 *   PublicStoreSettings  the subset a shopper is already shown — mirrors the
 *                        store_settings_public view column for column, and is
 *                        what the storefront carries to the browser.
 *
 * Keeping them as separate types rather than a Pick<> is deliberate: the
 * database has a view that decides what is public, and a second definition
 * that has to be edited alongside it is a second chance to notice that a new
 * setting is about to be handed to every visitor.
 */

export interface PublicStoreSettings {
  storeName: string;
  supportEmail: string | null;
  contactPhone: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankSortCode: string | null;
  /** VAT as a fraction, e.g. 0.075 for 7.5%. */
  taxRate: number;
  /** Items subtotal at or above which delivery is free. 0 means no such offer. */
  freeShippingThreshold: number;
  /** The single definition of "low stock", everywhere. */
  lowStockThreshold: number;
}

export interface StoreSettings extends PublicStoreSettings {
  orderNumberPrefix: string;
  /** Days from placing a supplier order to the units being on the shelf. */
  reorderLeadDays: number;
  /** Days of stock to hold beyond the lead time. */
  reorderCoverDays: number;
  notifyOrderReceived: boolean;
  notifyStatusChange: boolean;
  notifySms: boolean;
  notifyMarketing: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** The fields the Settings page can write. Everything else about the row —
 *  its id, who touched it, when — is the server's to set. */
export type StoreSettingsInput = Omit<StoreSettings, 'updatedAt' | 'updatedBy'>;
