/**
 * The contact and newsletter schemas.
 *
 * The newsletter one is the reason this file exists: it previously accepted any
 * non-empty string as an email address and upserted it into `subscribers`, so
 * "not-an-email" became a permanent row that every later campaign tried to mail.
 */
import { describe, it, expect } from 'vitest';
import { contactFormSchema, subscribeSchema } from './public-forms';
import { isBotSubmission } from './common';

const errorFields = (schema: { safeParse: (v: unknown) => any }, input: unknown): string[] => {
  const result = schema.safeParse(input);
  expect(result.success, 'expected this input to be rejected').toBe(false);
  return result.error.issues.map((i: any) => i.path.join('.') || '_').sort();
};

const parsed = (schema: { safeParse: (v: unknown) => any }, input: unknown): any => {
  const result = schema.safeParse(input);
  expect(result.success, `expected this to parse: ${JSON.stringify(result.error?.issues)}`).toBe(true);
  return result.data;
};

describe('subscribeSchema', () => {
  it('rejects a value that is not an email address', () => {
    // The exact input that used to be stored and answered with 200.
    expect(errorFields(subscribeSchema, { email: 'not-an-email', name: 'Ada' })).toEqual(['email']);
  });

  it('normalises a valid address to lowercase and trims it', () => {
    expect(parsed(subscribeSchema, { email: '  Ada@Example.COM ', name: ' Ada ' }))
      .toMatchObject({ email: 'ada@example.com', name: 'Ada' });
  });

  it('requires the email and names it', () => {
    expect(errorFields(subscribeSchema, {})).toEqual(['email']);
  });

  it('accepts a signup with no name at all', () => {
    // The footer form sends one field. The name became optional when that
    // form was wired up; subscribers.name is nullable for the same reason.
    expect(parsed(subscribeSchema, { email: 'ada@example.com' }))
      .toMatchObject({ email: 'ada@example.com', name: '' });
  });

  it('rejects a non-string email instead of coercing it', () => {
    expect(errorFields(subscribeSchema, { email: 42, name: 'Ada' })).toEqual(['email']);
    expect(errorFields(subscribeSchema, { email: { a: 1 }, name: 'Ada' })).toEqual(['email']);
  });

  it('caps an over-long address', () => {
    expect(errorFields(subscribeSchema, { email: `${'a'.repeat(300)}@b.co`, name: 'Ada' })).toEqual(['email']);
  });

  it('keeps the honeypot fields so the route can still see them', () => {
    const result = parsed(subscribeSchema, { email: 'a@b.co', name: 'Ada', website: 'http://spam' });
    expect(isBotSubmission(result)).toBe(true);
  });

  it('strips anything else, including columns on the subscribers table', () => {
    const result = parsed(subscribeSchema, { email: 'a@b.co', name: 'Ada', is_active: false, id: 'x' });
    expect(result).not.toHaveProperty('is_active');
    expect(result).not.toHaveProperty('id');
  });
});

describe('contactFormSchema', () => {
  const valid = { name: 'Ada', email: 'ada@example.com', message: 'Hello there' };

  it('accepts a normal submission and defaults the absent phone', () => {
    expect(parsed(contactFormSchema, valid)).toMatchObject({ ...valid, phone: '' });
  });

  it('rejects a non-string name rather than throwing on .trim()', () => {
    expect(errorFields(contactFormSchema, { ...valid, name: 123 })).toEqual(['name']);
  });

  it('requires name, email and message', () => {
    expect(errorFields(contactFormSchema, {})).toEqual(['email', 'message', 'name']);
  });

  it('treats whitespace-only text as missing', () => {
    expect(errorFields(contactFormSchema, { ...valid, message: '    ' })).toEqual(['message']);
  });

  it('caps the message so an unbounded body cannot be mailed on', () => {
    expect(errorFields(contactFormSchema, { ...valid, message: 'x'.repeat(6000) })).toEqual(['message']);
  });
});

describe('isBotSubmission', () => {
  it('is true only when a honeypot actually holds something', () => {
    expect(isBotSubmission({ website: 'http://spam' })).toBe(true);
    expect(isBotSubmission({ company_url: 'x' })).toBe(true);
    expect(isBotSubmission({ website: '   ' })).toBe(false);
    expect(isBotSubmission({ website: null, company_url: undefined })).toBe(false);
    expect(isBotSubmission({})).toBe(false);
  });
});
