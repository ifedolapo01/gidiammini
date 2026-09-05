import { describe, it, expect } from 'vitest';
import { parseListParams, listMeta, sanitizeSearchTerm, ilikeAcross } from './list-params';

const SPEC = { sortable: ['created_at', 'name'] as const, defaultSort: 'created_at' };

const parse = (query: string) => parseListParams(new URL(`https://example.test/api?${query}`), SPEC);

describe('parseListParams', () => {
  it('defaults to the first page, newest first', () => {
    const params = parse('');
    expect(params).toMatchObject({ page: 1, limit: 25, from: 0, to: 24, sort: 'created_at', ascending: false });
  });

  it('turns page and limit into an inclusive row range', () => {
    expect(parse('page=3&limit=10')).toMatchObject({ from: 20, to: 29 });
  });

  it('caps the page size, so ?limit=100000 cannot recreate the unbounded query', () => {
    expect(parse('limit=100000').limit).toBe(100);
  });

  it('ignores junk page and limit values rather than producing a negative range', () => {
    expect(parse('page=0&limit=-5')).toMatchObject({ page: 1, limit: 25, from: 0 });
    expect(parse('page=abc').page).toBe(1);
  });

  it('falls back to the default sort for a column the endpoint does not offer', () => {
    // A column PostgREST does not know is a 400, not a useful error, so an
    // unrecognised value must never reach it.
    expect(parse('sort=DROP TABLE').sort).toBe('created_at');
    expect(parse('sort=name&direction=asc')).toMatchObject({ sort: 'name', ascending: true });
  });
});

describe('listMeta', () => {
  it('reports the page count and whether more pages follow', () => {
    expect(listMeta({ page: 1, limit: 25 }, 60)).toEqual({
      page: 1, limit: 25, total: 60, totalPages: 3, hasMore: true,
    });
  });

  it('reports no pages at all for an empty result', () => {
    expect(listMeta({ page: 1, limit: 25 }, 0)).toMatchObject({ totalPages: 0, hasMore: false });
  });

  it('has no more pages on the last one', () => {
    expect(listMeta({ page: 3, limit: 25 }, 60).hasMore).toBe(false);
  });
});

describe('sanitizeSearchTerm', () => {
  it('removes the characters that are structural in a PostgREST filter', () => {
    // "Smith, J" would otherwise end the ilike condition and start another.
    expect(sanitizeSearchTerm('Smith, J')).toBe('Smith  J');
    expect(sanitizeSearchTerm(String.raw`a(b)c"d\e%f*g`)).toBe('a b c d e f g');
  });

  it('leaves an ordinary term alone', () => {
    expect(sanitizeSearchTerm('  GM-1042 ')).toBe('GM-1042');
  });

  it('bounds the length', () => {
    expect(sanitizeSearchTerm('x'.repeat(500))).toHaveLength(100);
  });
});

describe('ilikeAcross', () => {
  it('builds one wildcard condition per column', () => {
    expect(ilikeAcross(['name', 'email'], 'ade')).toBe('name.ilike.*ade*,email.ilike.*ade*');
  });
});
