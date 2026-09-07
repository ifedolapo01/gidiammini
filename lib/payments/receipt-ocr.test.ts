import { describe, it, expect } from 'vitest';
import { extractAmountGuess, extractReferenceGuess } from './receipt-ocr';

describe('extractAmountGuess', () => {
  it('picks the comma-formatted amount closest to what is owed', () => {
    const text = 'GTBank Alert\nAmount: 23,500.00\nAcct No: 0123456789\nDate: 04-Sep-2026';
    expect(extractAmountGuess(text, 23500)).toBe(23500);
  });

  it('ignores a long account-number-shaped digit run far from the expected amount', () => {
    const text = 'Acct No: 0123456789\nAmount: 5,000';
    expect(extractAmountGuess(text, 5000)).toBe(5000);
  });

  it('returns null when nothing in the text is plausibly close', () => {
    const text = 'Acct No: 0123456789\nRef: 998877665544';
    expect(extractAmountGuess(text, 5000)).toBeNull();
  });

  it('returns null for a non-positive expected amount', () => {
    expect(extractAmountGuess('Amount: 5,000', 0)).toBeNull();
  });

  it('accepts an amount within 20% of what is owed', () => {
    // Balance owing 18,000 after a part payment; receipt shows the original 20,000.
    expect(extractAmountGuess('Amount: 20,000.00', 18000)).toBe(20000);
  });

  it('rejects an amount more than 20% off', () => {
    expect(extractAmountGuess('Amount: 100,000.00', 5000)).toBeNull();
  });
});

describe('extractReferenceGuess', () => {
  it('matches a known reference verbatim over any digit run', () => {
    const text = 'Narration: UT00100000-a1b2c3d4 payment received, session id 998877665544';
    expect(extractReferenceGuess(text, ['UT00100000-a1b2c3d4'])).toBe('UT00100000-a1b2c3d4');
  });

  it('matches case-insensitively', () => {
    const text = 'ref ut00100000';
    expect(extractReferenceGuess(text, ['UT00100000'])).toBe('UT00100000');
  });

  it('falls back to the longest digit run when no known reference appears', () => {
    const text = 'Acct 012345 Session 000123456789012 Date 20260904';
    expect(extractReferenceGuess(text, ['UT00299999'])).toBe('000123456789012');
  });

  it('returns null when nothing at all is found', () => {
    expect(extractReferenceGuess('no digits here', ['UT00299999'])).toBeNull();
  });
});
