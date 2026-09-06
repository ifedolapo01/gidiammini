/**
 * The settings row's mapping and the free-delivery rule.
 *
 * Two things worth pinning down. The mapping, because every consumer of a
 * setting reaches it through a read that can fail and the whole design rests
 * on those failures landing on the old hardcoded values rather than on zero.
 * And applyFreeShipping, because a threshold of 0 has to mean "no offer" and
 * not "everything is free", which is the reading a naive `subtotal >= 0` gives.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STORE_SETTINGS,
  applyFreeShipping,
  publicSettingsFromRow,
  settingsFromRow,
  settingsToRow,
  toPublicSettings,
} from './store-settings';

describe('DEFAULT_STORE_SETTINGS', () => {
  it('matches the values that were hardcoded before the table existed', () => {
    // Changing either of these changes what an un-migrated deployment charges
    // and what it calls low stock, which is why they are asserted here rather
    // than left to the migration's DEFAULT alone.
    expect(DEFAULT_STORE_SETTINGS.taxRate).toBe(0.075);
    expect(DEFAULT_STORE_SETTINGS.lowStockThreshold).toBe(5);
    expect(DEFAULT_STORE_SETTINGS.orderNumberPrefix).toBe('UT');
    // The offer must be off until somebody turns it on.
    expect(DEFAULT_STORE_SETTINGS.freeShippingThreshold).toBe(0);
  });
});

describe('settingsFromRow', () => {
  it('falls back to the defaults for a missing row', () => {
    expect(settingsFromRow(null)).toEqual(DEFAULT_STORE_SETTINGS);
    expect(publicSettingsFromRow(undefined)).toEqual(toPublicSettings(DEFAULT_STORE_SETTINGS));
  });

  it('parses a numeric column that arrives as a string', () => {
    // PostgREST returns `numeric` as a string often enough that a bare read
    // would make tax_rate a string and every total NaN.
    const settings = settingsFromRow({ tax_rate: '0.10000' });
    expect(settings.taxRate).toBe(0.1);
  });

  it('falls back rather than yielding NaN for an unparseable rate', () => {
    expect(settingsFromRow({ tax_rate: 'not a number' }).taxRate).toBe(0.075);
  });

  it('treats a blank string as no value', () => {
    // The columns are nullable and "" is not an account number; a consumer
    // that has to distinguish '' from null is a consumer that will forget.
    const settings = settingsFromRow({ bank_account_number: '   ', support_email: '' });
    expect(settings.bankAccountNumber).toBeNull();
    expect(settings.supportEmail).toBeNull();
  });

  it('keeps a false toggle rather than defaulting it back to true', () => {
    expect(settingsFromRow({ notify_sms: false }).notifySms).toBe(false);
  });
});

describe('toPublicSettings', () => {
  it('drops everything a shopper has no business seeing', () => {
    const publicView = toPublicSettings({
      ...DEFAULT_STORE_SETTINGS,
      orderNumberPrefix: 'ZZ',
      notifyMarketing: false,
      updatedBy: 'some-admin-id',
    });

    expect(publicView).not.toHaveProperty('orderNumberPrefix');
    expect(publicView).not.toHaveProperty('notifyMarketing');
    expect(publicView).not.toHaveProperty('updatedBy');
    expect(publicView.taxRate).toBe(0.075);
  });
});

describe('settingsToRow', () => {
  it('normalises the prefix and blanks, and writes no timestamps', () => {
    const row = settingsToRow({
      ...DEFAULT_STORE_SETTINGS,
      storeName: '  Gidiam  ',
      orderNumberPrefix: ' gm ',
      bankName: '   ',
    });

    expect(row.store_name).toBe('Gidiam');
    expect(row.order_number_prefix).toBe('GM');
    expect(row.bank_name).toBeNull();
    // The audit diff relies on these being absent — see the settings route.
    expect(row).not.toHaveProperty('updated_at');
    expect(row).not.toHaveProperty('updated_by');
  });
});

describe('applyFreeShipping', () => {
  it('is off entirely at a threshold of zero', () => {
    expect(applyFreeShipping(2500, 0, 0)).toBe(2500);
    expect(applyFreeShipping(2500, 999999, 0)).toBe(2500);
  });

  it('waives the fee at or above the threshold', () => {
    expect(applyFreeShipping(2500, 20000, 20000)).toBe(0);
    expect(applyFreeShipping(2500, 20001, 20000)).toBe(0);
  });

  it('leaves the fee alone below it', () => {
    expect(applyFreeShipping(2500, 19999, 20000)).toBe(2500);
  });

  it('does not invent a fee where the zone charged none', () => {
    expect(applyFreeShipping(0, 5000, 20000)).toBe(0);
  });
});
