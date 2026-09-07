/**
 * The queue is already loaded in full; this is what turns "scroll through
 * forty pending orders looking for a name" into pasting the bank alert and
 * landing on the right row.
 */
import { describe, it, expect } from 'vitest';
import { extractOrderNumber, filterPaymentQueue, matchesPaymentQueueSearch } from './payment-queue-search';
import type { PaymentQueueItem } from '@/types/payment';

const item = (over: Partial<PaymentQueueItem> = {}): PaymentQueueItem => ({
  id: 'o1',
  order_number: 'UT00100000',
  customer_name: 'Amaka Okafor',
  customer_email: 'amaka@example.com',
  customer_phone: '08012345678',
  total_amount: 20000,
  amount_paid: 0,
  status: 'pending',
  payment_method: 'transfer',
  payment_verified: false,
  receipt_path: null,
  note: null,
  created_at: new Date().toISOString(),
  payment_reference: 'UT00100000-a1b2c3d4',
  payments: [],
  ...over,
});

describe('extractOrderNumber', () => {
  it('finds an order number inside a longer pasted message', () => {
    expect(extractOrderNumber('Credit alert: NGN20,000.00 from AMAKA OKAFOR ref UT00100000-xyz')).toBe(
      'UT00100000'
    );
  });

  it('is case-insensitive on the input but returns the uppercase token', () => {
    expect(extractOrderNumber('order ut00100000 paid')).toBe('UT00100000');
  });

  it('returns null when nothing matches', () => {
    expect(extractOrderNumber('no order number in here')).toBeNull();
  });
});

describe('matchesPaymentQueueSearch', () => {
  it('matches on an exact order number found inside pasted text', () => {
    expect(matchesPaymentQueueSearch(item(), 'ref UT00100000 confirmed')).toBe(true);
  });

  it('does not match a different order number found in the text', () => {
    expect(matchesPaymentQueueSearch(item(), 'ref UT00299999 confirmed')).toBe(false);
  });

  it('matches a partial customer name, case-insensitively', () => {
    expect(matchesPaymentQueueSearch(item(), 'amaka')).toBe(true);
  });

  it('matches a phone number', () => {
    expect(matchesPaymentQueueSearch(item(), '08012345678')).toBe(true);
  });

  it('matches the stored payment reference', () => {
    expect(matchesPaymentQueueSearch(item(), 'a1b2c3d4')).toBe(true);
  });

  it('is true for an empty query', () => {
    expect(matchesPaymentQueueSearch(item(), '')).toBe(true);
  });

  it('is false for a query matching nothing on the order', () => {
    expect(matchesPaymentQueueSearch(item(), 'nonexistent')).toBe(false);
  });
});

describe('filterPaymentQueue', () => {
  it('returns every item for an empty query', () => {
    const items = [item({ id: 'a' }), item({ id: 'b', customer_name: 'Tunde Bello' })];
    expect(filterPaymentQueue(items, '   ')).toHaveLength(2);
  });

  it('narrows to matching items only', () => {
    const items = [
      item({ id: 'a', customer_name: 'Amaka Okafor' }),
      item({ id: 'b', customer_name: 'Tunde Bello', order_number: 'UT00299999', payment_reference: 'UT00299999-zzzz' }),
    ];
    expect(filterPaymentQueue(items, 'tunde').map((i) => i.id)).toEqual(['b']);
  });
});
