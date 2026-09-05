import { describe, expect, it } from 'vitest';
import {
  PAYMENT_REJECTION_CODES,
  PAYMENT_REJECTION_REASONS,
  findRejectionReason,
  isPaymentRejectionCode,
  rejectionMessage,
} from './payment-rejection';

describe('the rejection vocabulary', () => {
  it('has one entry per code, and no extras', () => {
    expect(PAYMENT_REJECTION_REASONS.map((reason) => reason.code)).toEqual([
      ...PAYMENT_REJECTION_CODES,
    ]);
  });

  it('gives every ground a next step, which is the point of the list', () => {
    for (const reason of PAYMENT_REJECTION_REASONS) {
      expect(reason.nextStep.trim().length).toBeGreaterThan(0);
      expect(reason.headline.trim().length).toBeGreaterThan(0);
    }
  });

  it('recognises only known codes', () => {
    expect(isPaymentRejectionCode('duplicate')).toBe(true);
    expect(isPaymentRejectionCode('because-i-said-so')).toBe(false);
    expect(isPaymentRejectionCode(null)).toBe(false);
  });
});

describe('rejectionMessage', () => {
  it('returns the ground that was picked', () => {
    const message = rejectionMessage('unreadable');

    expect(message.headline).toBe(findRejectionReason('unreadable')!.headline);
    expect(message.detail).toBeNull();
  });

  it('falls back to the generic ground for a code it does not know', () => {
    // A payment row written by a newer deployment must still produce a usable
    // email rather than throwing on the way out.
    const message = rejectionMessage('some-future-reason');

    expect(message.headline).toBe(findRejectionReason('other')!.headline);
  });

  it('keeps the canonical next step even when a note is given', () => {
    const message = rejectionMessage('other', '  the name does not match  ');

    expect(message.detail).toBe('the name does not match');
    expect(message.nextStep).toBe(findRejectionReason('other')!.nextStep);
  });

  it('treats a blank note as no note', () => {
    expect(rejectionMessage('duplicate', '   ').detail).toBeNull();
  });
});
