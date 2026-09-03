/**
 * Customer identity resolution.
 *
 * The drift guard at the bottom is the important part. The migration carries a
 * SQL copy of the phone normaliser so it can backfill phone_e164 for orders
 * that predate the customers table. Two implementations of one rule will drift
 * unless something checks — and the failure would be silent: backfilled
 * numbers subtly different from the ones the application writes afterwards,
 * splitting a buyer's SMS reachability by when they ordered.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normaliseEmail } from './customer-identity';
import { normalisePhone } from '@/lib/notifications/phone';

const MIGRATION = readFileSync(
  join(process.cwd(), 'supabase/migrations/20251101002500_customers.sql'),
  'utf8'
);

describe('normaliseEmail', () => {
  it('lower-cases and trims, matching the CHECK constraint on the column', () => {
    expect(normaliseEmail('  Ada@Example.COM ')).toBe('ada@example.com');
  });

  it('collapses casing so one person is one identity', () => {
    expect(normaliseEmail('ADA@EXAMPLE.COM')).toBe(normaliseEmail('ada@example.com'));
  });

  it('returns an empty string for anything that is not a string', () => {
    for (const value of [null, undefined, 42, {}, []]) {
      expect(normaliseEmail(value)).toBe('');
    }
  });

  it('produces a value the column CHECK would accept', () => {
    // The constraint is `email = lower(btrim(email))`.
    const result = normaliseEmail('  MiXeD@Example.COM  ');
    expect(result).toBe(result.trim().toLowerCase());
  });
});

describe('the SQL phone normaliser mirrors the TypeScript one', () => {
  /** The mobile prefixes the migration's SQL function accepts. */
  const sqlPrefixes = (): Set<string> => {
    const body = MIGRATION.slice(MIGRATION.indexOf('normalise_ng_msisdn'));
    const block = body.slice(body.indexOf('NOT IN ('), body.indexOf(') THEN'));
    return new Set(Array.from(block.matchAll(/'(\d{3})'/g), (m) => m[1]));
  };

  /** Every prefix the TypeScript normaliser accepts, discovered by probing it
   * rather than by importing the private constant. */
  const tsPrefixes = (): Set<string> => {
    const accepted = new Set<string>();
    for (let prefix = 700; prefix <= 999; prefix++) {
      const result = normalisePhone(`0${prefix}1234567`);
      if (result.ok) accepted.add(String(prefix));
    }
    return accepted;
  };

  it('accepts exactly the same set of mobile prefixes', () => {
    const sql = sqlPrefixes();
    const ts = tsPrefixes();

    expect(sql.size).toBeGreaterThan(40);
    expect([...sql].sort()).toEqual([...ts].sort());
  });

  it('agrees on the country code and output shape', () => {
    expect(MIGRATION).toContain("RETURN '234' || v_national");
    const result = normalisePhone('08096539067');
    expect(result.ok && result.msisdn).toBe('2348096539067');
  });

  it('agrees on the separators stripped', () => {
    // The TS version strips [\s\-().+]; the SQL regexp_replace must match.
    expect(MIGRATION).toContain("'[\\s\\-().+]'");
    expect(normalisePhone('(0809) 653-9067').ok).toBe(true);
  });

  it('agrees that a subscriber number is exactly ten digits', () => {
    expect(MIGRATION).toContain('length(v_national) <> 10');
    expect(normalisePhone('0809653906').ok).toBe(false);
    expect(normalisePhone('080965390678').ok).toBe(false);
  });

  it('agrees on the accepted international prefixes', () => {
    for (const literal of ["'00234%'", "'234%'", "'0%'"]) {
      expect(MIGRATION, `SQL is missing the ${literal} branch`).toContain(literal);
    }
    expect(normalisePhone('002348096539067').ok).toBe(true);
    expect(normalisePhone('2348096539067').ok).toBe(true);
    expect(normalisePhone('8096539067').ok).toBe(true);
  });
});

describe('the migration keeps the snapshot columns intact', () => {
  it('never writes to orders.customer_name/email/phone', () => {
    // Those three are the immutable record of what was typed at checkout. The
    // only UPDATE the migration runs on orders must set customer_id alone.
    const updates = Array.from(MIGRATION.matchAll(/UPDATE public\.orders[\s\S]*?;/g), (m) => m[0]);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toContain('SET customer_id');
    for (const column of ['customer_name', 'customer_email', 'customer_phone']) {
      expect(updates[0].includes(`SET ${column}`), `migration writes ${column}`).toBe(false);
      expect(updates[0].includes(`, ${column} =`), `migration writes ${column}`).toBe(false);
    }
  });

  it('keys identity on email alone, never a composite with phone', () => {
    expect(MIGRATION).toContain('CREATE UNIQUE INDEX IF NOT EXISTS customers_email_key');
    // A unique index spanning phone would break the live case of one number
    // shared by two email addresses.
    expect(MIGRATION).not.toMatch(/UNIQUE INDEX[^;]*\(\s*email\s*,\s*phone/i);
    expect(MIGRATION).not.toMatch(/UNIQUE INDEX[^;]*phone_e164\s*\)/i);
  });

  it('revokes the new table and view from anon and authenticated', () => {
    expect(MIGRATION).toMatch(/REVOKE ALL ON public\.customers\s+FROM anon, authenticated/);
    expect(MIGRATION).toMatch(/REVOKE ALL ON public\.customer_stats\s+FROM anon, authenticated/);
    expect(MIGRATION).toContain('ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY');
  });

  it('makes the stats view respect the caller’s RLS, not the owner’s', () => {
    // Without this a view over RLS-protected tables runs as its owner and
    // becomes a way around those policies.
    expect(MIGRATION).toMatch(/CREATE OR REPLACE VIEW public\.customer_stats\s+WITH \(security_invoker = true\)/);
  });

  it('leaves orders.customer_id nullable, so bookkeeping cannot fail a sale', () => {
    expect(MIGRATION).toContain('ADD COLUMN IF NOT EXISTS customer_id uuid');
    expect(MIGRATION).not.toMatch(/customer_id uuid[^;]*NOT NULL/);
    // Erasing a customer must not delete their order history.
    expect(MIGRATION).toContain('ON DELETE SET NULL');
  });
});
