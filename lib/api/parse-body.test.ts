/**
 * The request-body plumbing.
 *
 * The behaviour that matters here is the status code: unreadable or wrong-typed
 * input must come back as 400 with something the caller can act on, never as a
 * 500 reading "Something went wrong."
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { parseJsonBody, badRequest } from './parse-body';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  age: z.coerce.number().optional(),
});

/** A stand-in for NextRequest carrying just what parseJsonBody reads. */
const fakeRequest = (body: string | null, headers: Record<string, string> = {}) =>
  ({
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => {
      if (body === null) throw new SyntaxError('Unexpected end of JSON input');
      return JSON.parse(body);
    },
  }) as any;

const readBody = async (response: Response) => response.json();

describe('parseJsonBody', () => {
  it('returns typed data for a valid body', async () => {
    const result = await parseJsonBody(fakeRequest('{"name":"  Ada  ","age":"7"}'), schema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ name: 'Ada', age: 7 });
  });

  it('answers malformed JSON with 400, not 500', async () => {
    const result = await parseJsonBody(fakeRequest(null), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await readBody(result.response);
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/could not read/i);
    }
  });

  it('reports field-level errors a form can highlight', async () => {
    const result = await parseJsonBody(fakeRequest('{"name":"","age":"abc"}'), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await readBody(result.response);
      expect(body.fieldErrors.name).toBe('Name is required');
      expect(body.fieldErrors.age).toBeDefined();
    }
  });

  it('keeps `error` a human sentence, because every caller toasts it', async () => {
    const result = await parseJsonBody(fakeRequest('{"name":""}'), schema);
    if (!result.ok) {
      const body = await readBody(result.response);
      expect(body.error).toBe('Name is required');
      expect(typeof body.error).toBe('string');
    }
  });

  it('rejects an oversized body unread, by its declared length', async () => {
    const result = await parseJsonBody(
      fakeRequest('{"name":"Ada"}', { 'content-length': String(200 * 1024) }),
      schema
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(413);
      expect((await readBody(result.response)).error).toMatch(/too large/i);
    }
  });

  it('allows a body within the size limit', async () => {
    const result = await parseJsonBody(
      fakeRequest('{"name":"Ada"}', { 'content-length': '14' }),
      schema
    );
    expect(result.ok).toBe(true);
  });

  it('does not trip over a missing or unparseable content-length', async () => {
    const cases: Record<string, string>[] = [{}, { 'content-length': 'nonsense' }];
    for (const headers of cases) {
      const result = await parseJsonBody(fakeRequest('{"name":"Ada"}', headers), schema);
      expect(result.ok).toBe(true);
    }
  });

  it('rejects a non-object body against an object schema', async () => {
    for (const body of ['null', '[]', '"a string"', '42']) {
      const result = await parseJsonBody(fakeRequest(body), schema);
      expect(result.ok, `${body} should be rejected`).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(400);
    }
  });

  it('does not leak developer wording for a wrong-shaped body', async () => {
    // "Invalid input: expected object, received null" means nothing to a customer.
    for (const body of ['null', '[]', '"a string"']) {
      const result = await parseJsonBody(fakeRequest(body), schema);
      if (!result.ok) {
        const { error } = await readBody(result.response);
        expect(error, `${body} leaked internal wording`).not.toMatch(/expected|received|Invalid input/i);
        expect(error).toMatch(/could not read/i);
      }
    }
  });

  it('strips keys the schema does not name', async () => {
    const result = await parseJsonBody(
      fakeRequest('{"name":"Ada","status":"confirmed","is_admin":true}'),
      schema
    );
    if (result.ok) {
      expect(result.data).not.toHaveProperty('status');
      expect(result.data).not.toHaveProperty('is_admin');
    }
  });
});

describe('badRequest', () => {
  it('joins a handful of messages for the toast and keeps all in fieldErrors', async () => {
    const response = badRequest({ a: 'A bad.', b: 'B bad.', c: 'C bad.', d: 'D bad.' });
    const body = await readBody(response);
    expect(response.status).toBe(400);
    expect(body.error).toBe('A bad. B bad. C bad.');
    expect(Object.keys(body.fieldErrors)).toHaveLength(4);
  });

  it('still produces an error string when given nothing', async () => {
    const body = await readBody(badRequest({}));
    expect(body.error.length).toBeGreaterThan(0);
  });
});
