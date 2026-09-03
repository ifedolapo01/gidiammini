/**
 * Phone normalisation. Customers type their number however they like at
 * checkout and the column stores it verbatim, so this is what stands between
 * that and a provider that wants exactly `2348096539067`.
 */
import { describe, it, expect } from 'vitest';
import { normalisePhone, formatPhoneForDisplay } from './phone';

const ok = (input: string) => {
  const result = normalisePhone(input);
  expect(result.ok, `expected ${input} to parse`).toBe(true);
  return (result as { ok: true; msisdn: string }).msisdn;
};

const rejected = (input: unknown) => {
  const result = normalisePhone(input);
  expect(result.ok, `expected ${String(input)} to be rejected`).toBe(false);
  return (result as { ok: false; reason: string }).reason;
};

describe('normalisePhone — shapes people actually type', () => {
  it('accepts the local form with a leading zero', () => {
    expect(ok('08096539067')).toBe('2348096539067');
  });

  it('accepts the spaced local form, as printed on the store contact line', () => {
    expect(ok('0809 653 9067')).toBe('2348096539067');
  });

  it('accepts a leading plus and country code', () => {
    expect(ok('+2348096539067')).toBe('2348096539067');
    expect(ok('+234 809 653 9067')).toBe('2348096539067');
  });

  it('accepts the country code without a plus', () => {
    expect(ok('2348096539067')).toBe('2348096539067');
  });

  it('accepts the 00 international prefix', () => {
    expect(ok('002348096539067')).toBe('2348096539067');
  });

  it('accepts a bare subscriber number', () => {
    expect(ok('8096539067')).toBe('2348096539067');
  });

  it('tolerates hyphens, dots and brackets', () => {
    expect(ok('0809-653-9067')).toBe('2348096539067');
    expect(ok('(0809) 653 9067')).toBe('2348096539067');
  });

  it('handles every common network prefix', () => {
    for (const prefix of ['0703', '0705', '0803', '0806', '0811', '0813', '0816', '0903', '0906', '0912']) {
      expect(ok(`${prefix}1234567`)).toBe(`234${prefix.slice(1)}1234567`);
    }
  });
});

describe('normalisePhone — rejects rather than guessing', () => {
  it('rejects empty input', () => {
    expect(rejected('')).toBe('empty');
    expect(rejected('   ')).toBe('empty');
    expect(rejected(null)).toBe('empty');
    expect(rejected(undefined)).toBe('empty');
  });

  it('rejects anything containing letters', () => {
    expect(rejected('call me')).toBe('not_a_number');
    expect(rejected('0809ABC9067')).toBe('not_a_number');
  });

  it('rejects the wrong number of digits', () => {
    expect(rejected('0809653906')).toBe('unrecognised_format');   // one short
    expect(rejected('080965390678')).toBe('unrecognised_format'); // one long
    expect(rejected('12345')).toBe('unrecognised_format');
  });

  it('rejects a landline or an unknown network', () => {
    // A number the store cannot text is better refused than reported as sent.
    expect(rejected('012345678901'.slice(0, 11))).toBe('not_a_mobile');
    expect(rejected('05012345678'.slice(0, 11))).toBe('not_a_mobile');
  });

  it('rejects a non-string', () => {
    expect(rejected(8096539067)).toBe('empty');
    expect(rejected({})).toBe('empty');
  });
});

describe('formatPhoneForDisplay', () => {
  it('renders the familiar local grouping', () => {
    expect(formatPhoneForDisplay('2348096539067')).toBe('0809 653 9067');
  });

  it('round-trips with normalisePhone', () => {
    expect(ok(formatPhoneForDisplay('2348096539067'))).toBe('2348096539067');
  });

  it('returns the input unchanged when it is not the expected length', () => {
    expect(formatPhoneForDisplay('123')).toBe('123');
  });
});
