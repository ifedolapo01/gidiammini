/**
 * Normalising what a visitor typed.
 *
 * This is not the security boundary — search_products() rebuilds the tsquery
 * from word characters in Postgres, so nothing typed here can reach to_tsquery
 * as an operator. What this decides is whether a query is worth sending, and
 * what canonical form it is logged under: ten spellings of one demand should
 * read as one line in the zero-result report, not ten.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  normaliseSearchQuery,
  isSearchable,
  searchTerms,
  MIN_QUERY_LENGTH,
  MAX_QUERY_LENGTH,
} from './search-query';

const MIGRATION = readFileSync(
  join(process.cwd(), 'supabase/migrations/20251101002800_product_search.sql'),
  'utf8'
);

/** The SQL without its comments. Needed because the migration's own header
 * explains why a GENERATED column was not used, and a naive search for that
 * phrase finds the explanation. */
const SQL = MIGRATION.replace(/--[^\n]*/g, '');

describe('normaliseSearchQuery', () => {
  it('collapses casing and whitespace to one spelling', () => {
    expect(normaliseSearchQuery('  Nursing   BRA ')).toBe('nursing bra');
    expect(normaliseSearchQuery('Nursing Bra')).toBe(normaliseSearchQuery('nursing  bra'));
  });

  it('turns punctuation into a space rather than deleting it', () => {
    // "t-shirt" must read as two words, matching how the tsvector indexes it.
    expect(normaliseSearchQuery('t-shirt')).toBe('t shirt');
    expect(normaliseSearchQuery('0-3 months!')).toBe('0 3 months');
  });

  it('keeps letters from outside ASCII', () => {
    // \p{L} rather than a-z, so an accented or non-Latin query is not gutted.
    expect(normaliseSearchQuery('béb…é')).toBe('béb é');
  });

  it('caps the length rather than passing on a paste', () => {
    expect(normaliseSearchQuery('a'.repeat(500)).length).toBeLessThanOrEqual(MAX_QUERY_LENGTH);
  });

  it('returns an empty string for anything that is not text', () => {
    for (const value of [null, undefined, 42, {}, []]) {
      expect(normaliseSearchQuery(value)).toBe('');
    }
  });

  it('returns an empty string for punctuation only', () => {
    expect(normaliseSearchQuery('!!! ??')).toBe('');
  });
});

describe('isSearchable', () => {
  it('rejects a query too short to mean anything', () => {
    expect(isSearchable('a')).toBe(false);
    expect(isSearchable(' ')).toBe(false);
    expect(isSearchable('')).toBe(false);
  });

  it('accepts a query at the minimum length', () => {
    expect('ab'.length).toBe(MIN_QUERY_LENGTH);
    expect(isSearchable('ab')).toBe(true);
  });

  it('judges on the normalised form, not the raw one', () => {
    // Three characters of punctuation is not a two-character query.
    expect(isSearchable('!-!')).toBe(false);
    expect(isSearchable('  gown  ')).toBe(true);
  });
});

describe('searchTerms', () => {
  it('splits into the words the query is made of', () => {
    expect(searchTerms('Newborn  Sleepsuit')).toEqual(['newborn', 'sleepsuit']);
  });

  it('is empty for an unusable query', () => {
    expect(searchTerms('!!')).toEqual([]);
    expect(searchTerms(null)).toEqual([]);
  });
});

describe('the migration builds the index it needs', () => {
  it('weights the name above the description', () => {
    // A product called "Baby Gown" must beat one that merely mentions gowns.
    expect(MIGRATION).toContain("setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A')");
    expect(MIGRATION).toContain("coalesce(NEW.description, '')), 'D')");
  });

  it('indexes the vector with GIN, or the search is a sequential scan', () => {
    expect(MIGRATION).toContain('USING GIN (search_vector)');
  });

  it('maintains the vector by trigger, not a generated column', () => {
    // array_to_string is only STABLE, so a generated column would be refused
    // with 42P17 — the same failure 20251101002600 hit.
    expect(SQL).toContain('CREATE TRIGGER products_search_vector_trg');
    expect(SQL).not.toMatch(/search_vector[^;]*GENERATED ALWAYS AS/);
  });

  it('builds the tsquery in SQL, not from interpolated input', () => {
    // The query string is rebuilt from word characters, so nothing typed can
    // reach to_tsquery as an operator.
    expect(MIGRATION).toContain("regexp_split_to_table(COALESCE(p_query, ''), '[^[:alnum:]]+')");
    expect(MIGRATION).toContain("to_tsquery('english', v_query)");
  });

  it('prefix-matches the last word, so typeahead works mid-word', () => {
    expect(MIGRATION).toContain("|| ':*'");
  });

  it('logs searches without storing anything identifying', () => {
    expect(MIGRATION).toContain('CREATE TABLE IF NOT EXISTS public.search_queries');
    expect(MIGRATION).toContain('search_queries_zero_result_idx');
    for (const column of ['ip ', 'session', 'user_agent']) {
      expect(MIGRATION.includes(`  ${column}`), `search_queries should not store ${column}`).toBe(false);
    }
  });

  it('keeps the query log out of the browser', () => {
    expect(MIGRATION).toContain('ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY');
    expect(MIGRATION).toMatch(/REVOKE ALL ON public\.search_queries\s+FROM anon, authenticated/);
  });
});
