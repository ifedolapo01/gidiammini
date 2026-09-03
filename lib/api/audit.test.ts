/**
 * The audit trail's two pure parts.
 *
 * `redact` matters most: withAdminAuth records the submitted body of every
 * mutating request automatically, so anything secret-shaped that reaches an
 * admin endpoint would otherwise be written to a table and read back by the
 * activity feed. It has to fail safe on shapes nobody anticipated.
 *
 * `diffForAudit` is what makes an entry readable. Storing whole rows twice
 * leaves the reader hunting for the one changed number among thirty identical
 * ones.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { redact, diffForAudit, isEmptyDiff, withoutTimestamps } from './audit';

const MIGRATION = readFileSync(
  join(process.cwd(), 'supabase/migrations/20251101002700_audit_log.sql'),
  'utf8'
);

describe('redact', () => {
  it('replaces password-shaped values, whatever the casing or separator', () => {
    const result = redact({
      email: 'a@b.co',
      password: 'hunter2',
      Password: 'hunter2',
      admin_password_hash: 'x',
      apiKey: 'k',
      API_KEY: 'k',
      'stripe-secret-key': 's',
      authorization: 'Bearer x',
      jwt: 'e30',
    }) as Record<string, unknown>;

    expect(result.email).toBe('a@b.co');
    for (const key of Object.keys(result)) {
      if (key === 'email') continue;
      expect(result[key], `${key} was not redacted`).toBe('[redacted]');
    }
  });

  it('redacts nested values, not just top-level ones', () => {
    const result = redact({ order: { payment: { token: 'abc' }, total: 100 } }) as any;
    expect(result.order.payment.token).toBe('[redacted]');
    expect(result.order.total).toBe(100);
  });

  it('redacts inside arrays', () => {
    const result = redact([{ password: 'a' }, { name: 'b' }]) as any[];
    expect(result[0].password).toBe('[redacted]');
    expect(result[1].name).toBe('b');
  });

  it('does not record a receipt path or an idempotency key', () => {
    // Neither is a credential, but both identify a specific payment attempt
    // and neither belongs in a feed an operator browses.
    const result = redact({ receipt_path: 'receipts/2026/x.png', idempotency_key: 'uuid' }) as any;
    expect(result.receipt_path).toBe('[redacted]');
    expect(result.idempotency_key).toBe('[redacted]');
  });

  it('passes primitives through unchanged', () => {
    expect(redact('plain')).toBe('plain');
    expect(redact(42)).toBe(42);
    expect(redact(true)).toBe(true);
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeNull();
  });

  it('stops rather than hanging on deeply nested input', () => {
    // A body nested past the limit is truncated, not followed forever.
    let deep: any = 'bottom';
    for (let i = 0; i < 30; i++) deep = { next: deep };
    const result = JSON.stringify(redact(deep));
    expect(result).toContain('[truncated]');
    expect(result.length).toBeLessThan(500);
  });

  it('survives a cyclic object instead of throwing', () => {
    const cyclic: any = { name: 'x' };
    cyclic.self = cyclic;
    expect(() => redact(cyclic)).not.toThrow();
  });

  it('describes exotic values rather than serialising them badly', () => {
    const result = redact({ when: new Date('2026-01-01T00:00:00Z'), fn: () => 1 }) as any;
    expect(typeof result.when).toBe('string');
    expect(typeof result.fn).toBe('string');
  });
});

describe('diffForAudit', () => {
  it('keeps only the fields that changed', () => {
    const diff = diffForAudit(
      { id: '1', name: 'Gown', price: 13000, stock: 4 },
      { id: '1', name: 'Gown', price: 16000, stock: 4 }
    );
    expect(diff.before).toEqual({ price: 13000 });
    expect(diff.after).toEqual({ price: 16000 });
  });

  it('compares nested objects by value, not identity', () => {
    const before = { pricing_config: { mode: 'single', singleStock: 4 } };
    const after = { pricing_config: { mode: 'single', singleStock: 4 } };
    expect(isEmptyDiff(diffForAudit(before, after))).toBe(true);
  });

  it('reports a nested change', () => {
    const diff = diffForAudit(
      { pricing_config: { mode: 'single', singleStock: 4 } },
      { pricing_config: { mode: 'single', singleStock: 9 } }
    );
    expect(diff.after).toHaveProperty('pricing_config');
  });

  it('includes a field present on only one side', () => {
    const added = diffForAudit({ a: 1 }, { a: 1, b: 2 });
    expect(added.after).toEqual({ b: 2 });
    expect(added.before).toEqual({ b: null });

    const removed = diffForAudit({ a: 1, b: 2 }, { a: 1 });
    expect(removed.before).toEqual({ b: 2 });
    expect(removed.after).toEqual({ b: null });
  });

  it('treats null and absent as the same, so a no-op save records nothing', () => {
    expect(isEmptyDiff(diffForAudit({ a: null }, {}))).toBe(true);
    expect(isEmptyDiff(diffForAudit({}, { a: undefined }))).toBe(true);
  });

  it('redacts secrets that appear in a diff', () => {
    const diff = diffForAudit({ password: 'old' }, { password: 'new' });
    expect(diff.before).toEqual({ password: '[redacted]' });
    expect(diff.after).toEqual({ password: '[redacted]' });
  });

  it('handles a missing side without throwing', () => {
    expect(diffForAudit(null, { a: 1 }).after).toEqual({ a: 1 });
    expect(diffForAudit({ a: 1 }, null).before).toEqual({ a: 1 });
    expect(isEmptyDiff(diffForAudit(null, null))).toBe(true);
  });
});

describe('withoutTimestamps', () => {
  it('drops a save that only moved updated_at', () => {
    // Opening a form and pressing save with no edits produced a feed entry
    // reading "updated_at: then to now", which tells a reader nothing.
    const diff = diffForAudit(
      { name: 'X', updated_at: '2026-01-01T00:00:00Z' },
      { name: 'X', updated_at: '2026-01-02T00:00:00Z' }
    );
    expect(isEmptyDiff(diff)).toBe(false);
    expect(isEmptyDiff(withoutTimestamps(diff))).toBe(true);
  });

  it('keeps the real change alongside a moved timestamp', () => {
    const diff = withoutTimestamps(diffForAudit(
      { price: 100, updated_at: 'a' },
      { price: 200, updated_at: 'b' }
    ));
    expect(diff.after).toEqual({ price: 200 });
  });
});

describe('the migration keeps the trail trustworthy', () => {
  it('refuses UPDATE on an entry', () => {
    // An audit entry that can be edited is not evidence.
    expect(MIGRATION).toContain('CREATE TRIGGER audit_log_no_update');
    expect(MIGRATION).toContain('BEFORE UPDATE ON public.audit_log');
    expect(MIGRATION).toContain('audit_log is append-only');
  });

  it('is unreadable with the anon key', () => {
    // Entries hold before/after snapshots of orders and customers.
    expect(MIGRATION).toContain('ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY');
    expect(MIGRATION).toMatch(/REVOKE ALL ON public\.audit_log\s+FROM anon, authenticated/);
    expect(MIGRATION).not.toContain('GRANT SELECT');
  });

  it('will not prune recent history', () => {
    expect(MIGRATION).toContain('Refusing to prune audit history younger than 30 days');
  });

  it('indexes the two queries the UI makes', () => {
    // Per-entity History, and the newest-first feed.
    expect(MIGRATION).toContain('audit_log_entity_idx');
    expect(MIGRATION).toContain('(entity_type, entity_id, created_at DESC)');
    expect(MIGRATION).toContain('audit_log_created_at_idx');
  });

  it('keys entity_id as text, since not every entity is a uuid', () => {
    // A stock change is addressed by variant key ('3-5 months|Yellow').
    expect(MIGRATION).toMatch(/entity_id text/);
    expect(MIGRATION).not.toMatch(/entity_id uuid/);
  });
});
