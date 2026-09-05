import { describe, it, expect } from 'vitest';
import { phoneSearchDigits, phoneSearchTerm } from './phone-search';

describe('phoneSearchDigits', () => {
  it('reduces every way of writing the same number to one form', () => {
    // The whole point: these are the same customer, and searching any of them
    // has to find an order stored as any other.
    const forms = ['0809 653 9067', '+234 809 653 9067', '08096539067', '2348096539067', '00234 809 653 9067'];
    const reduced = new Set(forms.map(phoneSearchDigits));
    expect([...reduced]).toEqual(['8096539067']);
  });

  it('strips punctuation people type', () => {
    expect(phoneSearchDigits('(0809) 653-9067')).toBe('8096539067');
  });

  it('leaves a fragment as a fragment', () => {
    expect(phoneSearchDigits('653 9067')).toBe('6539067');
  });

  it('returns nothing for text', () => {
    expect(phoneSearchDigits('Ada Lovelace')).toBe('');
  });
});

describe('phoneSearchTerm', () => {
  it('accepts a fragment long enough to mean something', () => {
    expect(phoneSearchTerm('9067')).toBe('9067');
    expect(phoneSearchTerm('0809 653')).toBe('809653');
  });

  it('declines a term too short to narrow anything', () => {
    // A two-digit contains-match would return most of the order history.
    expect(phoneSearchTerm('12')).toBeNull();
    expect(phoneSearchTerm('080')).toBeNull();
  });

  it('declines a text search', () => {
    expect(phoneSearchTerm('Ada')).toBeNull();
    expect(phoneSearchTerm('')).toBeNull();
  });
});
