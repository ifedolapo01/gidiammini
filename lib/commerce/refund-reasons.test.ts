import { describe, expect, it } from 'vitest';
import {
  REFUND_CODES,
  REFUND_METHODS,
  REFUND_METHOD_LABELS,
  REFUND_REASONS,
  REFUND_STATUSES,
  findRefundReason,
  isRefundCode,
  isRefundMethod,
  isRefundStatus,
  refundLabel,
  refundMessage,
} from './refund-reasons';

describe('the refund vocabulary', () => {
  it('has one entry per code, and no entry without a code', () => {
    expect(REFUND_REASONS.map((reason) => reason.code)).toEqual([...REFUND_CODES]);
  });

  it('gives every ground a label, a hint and a customer sentence', () => {
    for (const reason of REFUND_REASONS) {
      expect(reason.label, reason.code).toBeTruthy();
      expect(reason.hint, reason.code).toBeTruthy();
      expect(reason.customerMessage, reason.code).toBeTruthy();
    }
  });

  it('marks the grounds that normally mean the whole order', () => {
    expect(findRefundReason('order_cancelled')?.usuallyFull).toBe(true);
    expect(findRefundReason('not_delivered')?.usuallyFull).toBe(true);
    // A goodwill gesture is a part refund by definition.
    expect(findRefundReason('goodwill')?.usuallyFull).toBeUndefined();
  });

  it('labels every method the database will accept', () => {
    // The CHECK on order_refunds.method and this list have to agree, or the
    // picker offers a value the insert refuses.
    for (const method of REFUND_METHODS) {
      expect(REFUND_METHOD_LABELS[method], method).toBeTruthy();
    }
  });
});

describe('the type guards', () => {
  it('accept known values', () => {
    expect(isRefundCode('goodwill')).toBe(true);
    expect(isRefundMethod('store_credit')).toBe(true);
    expect(isRefundStatus('completed')).toBe(true);
  });

  it('refuse everything else, whatever shape it arrives in', () => {
    expect(isRefundCode('nope')).toBe(false);
    expect(isRefundCode(null)).toBe(false);
    expect(isRefundMethod('bitcoin')).toBe(false);
    expect(isRefundMethod(3)).toBe(false);
    expect(isRefundStatus('refunded')).toBe(false);
    expect(isRefundStatus(undefined)).toBe(false);
  });

  it('lists the statuses in the order a refund moves through them', () => {
    expect(REFUND_STATUSES).toEqual(['pending', 'completed', 'failed']);
  });
});

describe('refundLabel', () => {
  it('names a known ground and falls back to the raw value', () => {
    expect(refundLabel('item_faulty')).toBe('Item arrived faulty');
    expect(refundLabel('from_a_newer_build')).toBe('from_a_newer_build');
    expect(refundLabel(null)).toBe('Unspecified');
  });
});

describe('refundMessage', () => {
  it('uses the ground’s own sentence', () => {
    expect(refundMessage('order_cancelled')).toBe('This is the refund for your cancelled order.');
  });

  it('appends the note rather than replacing the sentence', () => {
    const message = refundMessage('goodwill', 'Sorry about the delay.');

    expect(message).toContain('as an apology');
    expect(message.endsWith('Sorry about the delay.')).toBe(true);
  });

  it('falls back to the generic ground for an unknown code', () => {
    expect(refundMessage('who_knows')).toBe(findRefundReason('other')!.customerMessage);
  });
});
