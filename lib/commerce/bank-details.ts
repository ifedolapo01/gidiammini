/**
 * COMMERCE layer — the account a customer transfers to. Pure.
 *
 * Three sources, in order: the settings row the owner controls, the
 * NEXT_PUBLIC_* environment variables that held these values before the
 * settings table existed, and the literals that were the `||` fallbacks in
 * components/checkout/PaymentStep.tsx.
 *
 * The env layer is not legacy cruft to be deleted in the same change that
 * introduces the table. Until somebody opens the Settings page and presses
 * Save, every bank column is NULL — and a checkout that responds to a new
 * migration by showing a blank account number is a checkout that loses money
 * that day. The env vars keep the shop taking transfers across the gap, and
 * stop mattering the moment the row is filled in.
 *
 * A separate module from store-settings.ts because that one is the shape of
 * the row and this one is a resolution policy over it, and because both stay
 * comfortably readable apart.
 */
import type { PublicStoreSettings } from '@/types/settings';

export interface BankTransferDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  sortCode: string;
}

function firstNonEmpty(...values: (string | null | undefined)[]): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

export function resolveBankDetails(settings: PublicStoreSettings): BankTransferDetails {
  return {
    bankName: firstNonEmpty(settings.bankName, process.env.NEXT_PUBLIC_BANK_NAME, 'OPAY'),
    accountName: firstNonEmpty(settings.bankAccountName, process.env.NEXT_PUBLIC_ACCOUNT_NAME, 'Ifedolapo Ajayi'),
    accountNumber: firstNonEmpty(settings.bankAccountNumber, process.env.NEXT_PUBLIC_ACCOUNT_NUMBER, '8096539067'),
    sortCode: firstNonEmpty(settings.bankSortCode, process.env.NEXT_PUBLIC_SORT_CODE, '011'),
  };
}
