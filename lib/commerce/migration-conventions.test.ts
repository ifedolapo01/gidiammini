/**
 * Conventions every migration in supabase/migrations must follow.
 *
 * These exist because of a real failed push: 20251101002500 defaulted an id to
 * `uuid_generate_v4()`, copied from the baseline. That works on a local rebuild
 * — the baseline runs CREATE EXTENSION "uuid-ossp", which lands in `public` —
 * but hosted Supabase already has uuid-ossp in the `extensions` schema, so
 * CREATE EXTENSION is a no-op and the bare function name does not resolve from
 * the search_path `supabase db push` uses. The push failed at the first
 * statement with SQLSTATE 42883.
 *
 * A file-level check catches that class of mistake before it reaches a
 * database, which is the only place it shows up.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'supabase/migrations');

/** The baseline is exempt: it documents the original production DDL verbatim,
 * including its uuid-ossp defaults, and is already applied everywhere. */
const BASELINE = '20251101000000_baseline_core_tables.sql';

/** SQL line comments, removed so prose mentioning a function never trips a check. */
const stripComments = (sql: string): string => sql.replace(/--[^\n]*/g, '');

const migrations = readdirSync(DIR)
  .filter((name) => name.endsWith('.sql'))
  .map((name) => ({ name, sql: readFileSync(join(DIR, name), 'utf8') }));

describe('migration conventions', () => {
  it('finds the migration files', () => {
    expect(migrations.length).toBeGreaterThan(20);
  });

  it('uses gen_random_uuid(), never unqualified uuid_generate_v4()', () => {
    for (const { name, sql } of migrations) {
      if (name === BASELINE) continue;

      // Strip comments first, so prose mentioning the function does not trip.
      const code = stripComments(sql);
      expect(
        code.includes('uuid_generate_v4'),
        `${name} calls uuid_generate_v4(), which does not resolve on hosted Supabase`
      ).toBe(false);
    }
  });

  it('uses only immutable functions inside a generated column', () => {
    // A real failed push: `variant_key text GENERATED ALWAYS AS (
    // COALESCE(NULLIF(concat_ws('|', size, color), ''), 'single')) STORED`
    // was refused with "generation expression is not immutable" (42P17).
    // concat_ws is merely STABLE — it takes "any" arguments and calls their
    // type output functions. Postgres only tells you this when the statement
    // reaches a server, so check it here instead.
    const stableOnly = ['concat_ws', 'concat(', 'to_char(', 'now(', 'current_', 'format('];

    for (const { name, sql } of migrations) {
      const code = stripComments(sql);
      // Each GENERATED ALWAYS AS (...) expression, up to its STORED keyword.
      for (const match of code.matchAll(/GENERATED ALWAYS AS\s*\(([\s\S]*?)\)\s*STORED/g)) {
        for (const fn of stableOnly) {
          expect(
            match[1].includes(fn),
            `${name} uses ${fn} in a generated column, which Postgres rejects as not immutable`
          ).toBe(false);
        }
      }
    }
  });

  it('does not call other extension functions unqualified', () => {
    // Same failure mode: these all live in `extensions` on hosted Supabase.
    const risky = ['digest(', 'crypt(', 'gen_salt(', 'uuid_nil('];
    for (const { name, sql } of migrations) {
      if (name === BASELINE) continue;
      const code = stripComments(sql);
      for (const fn of risky) {
        expect(code.includes(fn), `${name} calls ${fn} unqualified`).toBe(false);
      }
    }
  });
});
