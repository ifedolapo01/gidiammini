/**
 * Request schema for the Settings page.
 *
 * Every constraint here has a CHECK behind it in migration
 * 20260905200000_store_settings.sql. That duplication is deliberate: the CHECK
 * is the guarantee — it also governs a value set by hand in the SQL editor —
 * and this is what turns a violation into a sentence naming the field instead
 * of a 500 carrying a constraint name.
 *
 * The whole row every time, not a patch. There are fifteen fields on one form
 * with one Save button; a partial update API would exist only to let a caller
 * do something the UI cannot.
 */
import { z } from 'zod';
import { MAX_LENGTHS, optionalText, requiredText } from './common';

/** Blank optional text becomes null rather than '' — the columns are nullable
 *  and "no support email" is a NULL, not an empty string that every reader
 *  then has to treat as one. */
function nullableText(label: string, max: number) {
  return optionalText(label, max).transform((value) => (value === '' ? null : value));
}

export const storeSettingsSchema = z.object({
  storeName: requiredText('Store name', MAX_LENGTHS.name),
  supportEmail: nullableText('Support email', MAX_LENGTHS.email),
  contactPhone: nullableText('Contact phone', MAX_LENGTHS.phone),

  bankName: nullableText('Bank name', MAX_LENGTHS.name),
  bankAccountName: nullableText('Account name', MAX_LENGTHS.name),
  bankAccountNumber: nullableText('Account number', 32),
  bankSortCode: nullableText('Sort code', 16),

  /**
   * A fraction, not a percentage. The form shows 7.5 and divides by 100 before
   * it gets here, because an owner types the number they see on an invoice —
   * but the wire format matches the column, so nothing downstream has to know
   * which of the two it is holding.
   */
  taxRate: z
    .number({ error: 'The tax rate must be a number.' })
    .min(0, 'The tax rate cannot be negative.')
    .max(1, 'The tax rate must be a fraction — 0.075 for 7.5%, not 7.5.'),

  freeShippingThreshold: z
    .number({ error: 'The free-delivery threshold must be a number.' })
    .int('The free-delivery threshold must be a whole number of naira.')
    .min(0, 'The free-delivery threshold cannot be negative.'),

  lowStockThreshold: z
    .number({ error: 'The low-stock threshold must be a number.' })
    .int('The low-stock threshold must be a whole number.')
    .min(0, 'The low-stock threshold cannot be negative.')
    // Not a database CHECK, because the database has no opinion about what is
    // useful. A threshold in the hundreds would mark the entire catalogue low
    // and make the alert meaningless, which is worth catching at the form.
    .max(1000, 'A low-stock threshold above 1000 would flag the whole catalogue.'),

  orderNumberPrefix: requiredText('Order number prefix', 6)
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,6}$/, 'The prefix may use up to 6 letters and digits, with no spaces.'),

  /** Both bounded at a year, matching the CHECK. A typo here multiplies every
   *  suggested order quantity rather than failing visibly. */
  reorderLeadDays: z
    .number({ error: 'The supplier lead time must be a number.' })
    .int('The supplier lead time must be a whole number of days.')
    .min(0, 'The supplier lead time cannot be negative.')
    .max(365, 'A supplier lead time over a year is almost certainly a typo.'),

  reorderCoverDays: z
    .number({ error: 'The cover target must be a number.' })
    .int('The cover target must be a whole number of days.')
    .min(0, 'The cover target cannot be negative.')
    .max(365, 'A cover target over a year is almost certainly a typo.'),

  notifyOrderReceived: z.boolean({ error: 'Order-received notifications must be on or off.' }),
  notifyStatusChange: z.boolean({ error: 'Status-change notifications must be on or off.' }),
  notifySms: z.boolean({ error: 'SMS notifications must be on or off.' }),
  notifyMarketing: z.boolean({ error: 'Marketing emails must be on or off.' }),
});

export type StoreSettingsBody = z.infer<typeof storeSettingsSchema>;
