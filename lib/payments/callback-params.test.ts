/**
 * Reading the reference off the provider's return URL.
 *
 * Every case here is one a real customer hit or could hit. The duplicate is
 * not hypothetical: it shipped, and it told somebody whose card had been
 * charged that we had not seen their payment.
 */
import { describe, it, expect } from 'vitest';
import { paymentReferenceFrom } from './callback-params';

const REF = 'UT00100016-69061f2c';

describe('paymentReferenceFrom', () => {
  it('reads a single reference', () => {
    expect(paymentReferenceFrom({ reference: REF })).toBe(REF);
  });

  it('survives the parameter appearing twice', () => {
    // ?reference=X&trxref=X&reference=X — Next hands this over as an array,
    // and the array used to reach the provider encoded as "X,X".
    expect(paymentReferenceFrom({ reference: [REF, REF], trxref: REF })).toBe(REF);
  });

  it('falls back to trxref when reference is absent', () => {
    expect(paymentReferenceFrom({ trxref: REF })).toBe(REF);
  });

  it('prefers reference, which is the name we chose and store', () => {
    expect(paymentReferenceFrom({ reference: REF, trxref: 'something-else' })).toBe(REF);
  });

  it('ignores blanks rather than treating them as a reference', () => {
    expect(paymentReferenceFrom({ reference: '   ', trxref: REF })).toBe(REF);
    expect(paymentReferenceFrom({ reference: ['', REF] })).toBe(REF);
  });

  it('answers null when there is nothing to read', () => {
    expect(paymentReferenceFrom({})).toBeNull();
    expect(paymentReferenceFrom({ reference: [] })).toBeNull();
    expect(paymentReferenceFrom({ reference: '' })).toBeNull();
  });
});
