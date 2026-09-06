/** ADMIN layer — the four groups of settings, as fields over the draft.
 *
 * Presentation only. Every group takes the same two props — the draft and the
 * setter — rather than fifteen individual value/onChange pairs, because the
 * alternative is a page component that is nothing but prop plumbing.
 */
'use client';

import { SettingsField, SettingsSection, SettingsToggle } from './SettingsField';
import type { SettingsDraft } from '../hooks/settings-draft';
import type { FieldErrors } from '@/lib/api/field-errors';

export interface SectionProps {
  draft: SettingsDraft;
  setField: <K extends keyof SettingsDraft>(field: K, value: SettingsDraft[K]) => void;
  errors: FieldErrors;
  disabled?: boolean;
}

export function StoreIdentitySection({ draft, setField, errors }: SectionProps) {
  return (
    <SettingsSection
      title="Store identity"
      description="What the shop calls itself, and how a customer reaches a person."
    >
      <SettingsField
        id="storeName"
        label="Store name"
        hint="Used in emails and on printed order documents."
        value={draft.storeName}
        error={errors.storeName}
        onChange={(value) => setField('storeName', value)}
      />
      <SettingsField
        id="supportEmail"
        label="Support email"
        hint="Where customers are told to reply. Leave blank to use the sending address."
        type="email"
        inputMode="email"
        value={draft.supportEmail}
        error={errors.supportEmail}
        onChange={(value) => setField('supportEmail', value)}
      />
      <SettingsField
        id="contactPhone"
        label="Contact phone"
        hint="Shown to customers who need to call about an order."
        type="tel"
        inputMode="tel"
        value={draft.contactPhone}
        error={errors.contactPhone}
        onChange={(value) => setField('contactPhone', value)}
      />
    </SettingsSection>
  );
}

export function BankDetailsSection({ draft, setField, errors }: SectionProps) {
  return (
    <SettingsSection
      title="Bank transfer details"
      description="The account shown at checkout and repeated in payment reminders. Check the account number character by character before saving — this is where customers send money."
    >
      <SettingsField
        id="bankName"
        label="Bank name"
        hint="As the customer will see it in their banking app."
        value={draft.bankName}
        error={errors.bankName}
        onChange={(value) => setField('bankName', value)}
      />
      <SettingsField
        id="bankAccountName"
        label="Account name"
        hint="The name the transfer must be made out to."
        value={draft.bankAccountName}
        error={errors.bankAccountName}
        onChange={(value) => setField('bankAccountName', value)}
      />
      <SettingsField
        id="bankAccountNumber"
        label="Account number"
        hint="Customers copy this straight from the checkout page."
        inputMode="numeric"
        value={draft.bankAccountNumber}
        error={errors.bankAccountNumber}
        onChange={(value) => setField('bankAccountNumber', value)}
      />
      <SettingsField
        id="bankSortCode"
        label="Sort code"
        hint="Optional. Leave blank if your bank does not use one."
        inputMode="numeric"
        value={draft.bankSortCode}
        error={errors.bankSortCode}
        onChange={(value) => setField('bankSortCode', value)}
      />
    </SettingsSection>
  );
}

export function OperationsSection({ draft, setField, errors }: SectionProps) {
  return (
    <SettingsSection
      title="Pricing and stock"
      description="The numbers the checkout, the stock pages and the reorder suggestions work from."
    >
      <SettingsField
        id="taxRate"
        label="Tax rate"
        hint="VAT added to every order, as a percentage. Nigeria is 7.5%."
        inputMode="decimal"
        suffix="%"
        value={draft.taxPercent}
        error={errors.taxRate}
        onChange={(value) => setField('taxPercent', value)}
      />
      <SettingsField
        id="freeShippingThreshold"
        label="Free delivery over"
        hint="Orders at or above this subtotal pay no delivery fee. 0 turns the offer off."
        inputMode="numeric"
        prefix="₦"
        value={draft.freeShippingThreshold}
        error={errors.freeShippingThreshold}
        onChange={(value) => setField('freeShippingThreshold', value)}
      />
      <SettingsField
        id="lowStockThreshold"
        label="Low stock at or below"
        hint="One number for the whole product: the storefront badge, the dashboard card, the stock page filter and the alert bar."
        inputMode="numeric"
        value={draft.lowStockThreshold}
        error={errors.lowStockThreshold}
        onChange={(value) => setField('lowStockThreshold', value)}
      />
      <SettingsField
        id="reorderLeadDays"
        label="Supplier lead time"
        hint="Days from placing an order with your supplier to the stock being on the shelf. Half of every reorder point."
        inputMode="numeric"
        suffix="days"
        value={draft.reorderLeadDays}
        error={errors.reorderLeadDays}
        onChange={(value) => setField('reorderLeadDays', value)}
      />
      <SettingsField
        id="reorderCoverDays"
        label="Cover to hold"
        hint="Days of stock to keep on top of the lead time — the buffer that absorbs a good week."
        inputMode="numeric"
        suffix="days"
        value={draft.reorderCoverDays}
        error={errors.reorderCoverDays}
        onChange={(value) => setField('reorderCoverDays', value)}
      />
      <SettingsField
        id="orderNumberPrefix"
        label="Order number prefix"
        hint="Goes in front of every new order number. Existing orders keep the prefix they were issued with."
        value={draft.orderNumberPrefix}
        error={errors.orderNumberPrefix}
        onChange={(value) => setField('orderNumberPrefix', value.toUpperCase())}
      />
    </SettingsSection>
  );
}

export function NotificationsSection({ draft, setField }: SectionProps) {
  return (
    <SettingsSection
      title="Notifications"
      description="Which messages go out on their own. Turning one off means the shop handles it by hand — it does not queue anything for later."
    >
      <SettingsToggle
        id="notifyOrderReceived"
        label="Order received email"
        hint="Sent when a customer places an order."
        checked={draft.notifyOrderReceived}
        onChange={(checked) => setField('notifyOrderReceived', checked)}
      />
      <SettingsToggle
        id="notifyStatusChange"
        label="Status change email"
        hint="Sent when an order is confirmed, shipped or delivered."
        checked={draft.notifyStatusChange}
        onChange={(checked) => setField('notifyStatusChange', checked)}
      />
      <SettingsToggle
        id="notifySms"
        label="SMS notifications"
        hint="Text messages alongside email, where a number is on file."
        checked={draft.notifySms}
        onChange={(checked) => setField('notifySms', checked)}
      />
      <SettingsToggle
        id="notifyMarketing"
        label="Marketing emails"
        hint="Sale announcements to newsletter subscribers."
        checked={draft.notifyMarketing}
        onChange={(checked) => setField('notifyMarketing', checked)}
      />
    </SettingsSection>
  );
}
