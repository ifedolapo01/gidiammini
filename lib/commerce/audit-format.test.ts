/**
 * Turning audit rows into something readable.
 *
 * The fallbacks matter as much as the labels: `action` and `entity_type` are
 * free-form text in the database, so a route added later can record a value
 * this file has never heard of. That must still render as a sentence rather
 * than as a raw snake_case token or, worse, as blank.
 */
import { describe, it, expect } from 'vitest';
import {
  actionLabel,
  actionTone,
  entityLabel,
  actorLabel,
  entityShortId,
  fieldChanges,
  summarise,
  isFailedAttempt,
  needsFailureBadge,
  changeSummary,
  type AuditLogEntry,
} from './audit-format';

const entry = (over: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
  id: 'a1',
  actor_email: 'admin@example.com',
  entity_type: 'product',
  entity_id: '11111111-2222-3333-4444-555555555555',
  action: 'update',
  before: null,
  after: null,
  reason: null,
  method: 'PUT',
  path: '/api/admin/products',
  ip: '127.0.0.1',
  status_code: 200,
  created_at: '2026-09-02T10:00:00Z',
  ...over,
});

describe('labels', () => {
  it('names the actions an operator sees most', () => {
    expect(actionLabel('status_change')).toBe('Status changed');
    expect(actionLabel('stock_change')).toBe('Stock changed');
    expect(actionLabel('delete')).toBe('Deleted');
  });

  it('title-cases an action it has never seen', () => {
    // A route recording 'refund_issued' must not render the raw token.
    expect(actionLabel('refund_issued')).toBe('Refund Issued');
    expect(entityLabel('gift_card')).toBe('Gift Card');
  });

  it('tones destructive actions destructively', () => {
    expect(actionTone('delete')).toBe('destructive');
    expect(actionTone('block')).toBe('destructive');
    expect(actionTone('create')).toBe('success');
    expect(actionTone('unblock')).toBe('success');
  });

  it('falls back to a neutral tone rather than undefined', () => {
    expect(actionTone('something_new')).toBe('neutral');
  });

  it('says who, and names the shop itself when nobody did it', () => {
    expect(actorLabel(entry())).toBe('admin@example.com');
    // Not 'Unknown admin': an entry with no actor was written by something
    // automatic, not by somebody the trail failed to identify. Now that admins
    // are named, a missing address means the system, and saying so stops an
    // operator hunting for a person who was never there.
    expect(actorLabel(entry({ actor_email: null }))).toBe('System');
    expect(actorLabel(entry({ actor_email: '' }))).toBe('System');
  });
});

describe('entityShortId', () => {
  it('shortens a bare uuid to its first segment', () => {
    expect(entityShortId(entry())).toBe('11111111');
  });

  it('shows the variant key, which is the informative half', () => {
    // A variant is addressed as '<product uuid>:<variant key>'; the uuid tells
    // the reader nothing they can act on.
    expect(entityShortId({
      entity_type: 'product_variant',
      entity_id: '11111111-2222-3333-4444-555555555555:3-5 months|Yellow',
    })).toBe('3-5 months|Yellow');
  });

  it('leaves a non-uuid id alone', () => {
    expect(entityShortId({ entity_type: 'category', entity_id: 'babies' })).toBe('babies');
  });

  it('renders a dash rather than nothing when there is no id', () => {
    expect(entityShortId({ entity_type: 'request', entity_id: null })).toBe('—');
  });
});

describe('fieldChanges', () => {
  it('pairs before and after per field', () => {
    const changes = fieldChanges(entry({ before: { price: 13000 }, after: { price: 16000 } }));
    expect(changes).toEqual([{ field: 'Price', from: '13000', to: '16000' }]);
  });

  it('sorts by field, so one edit always reads the same way', () => {
    const changes = fieldChanges(entry({
      before: { stock: 1, price: 2, name: 'a' },
      after: { stock: 3, price: 4, name: 'b' },
    }));
    expect(changes.map((c) => c.field)).toEqual(['Name', 'Price', 'Stock']);
  });

  it('renders booleans and blanks as words, not as false or empty', () => {
    const changes = fieldChanges(entry({
      before: { is_blocked: false, notes: '' },
      after: { is_blocked: true, notes: 'chargeback' },
    }));
    expect(changes).toEqual([
      { field: 'Is Blocked', from: 'no', to: 'yes' },
      { field: 'Notes', from: '—', to: 'chargeback' },
    ]);
  });

  it('shows a missing side as a dash', () => {
    const changes = fieldChanges(entry({ before: null, after: { name: 'New' } }));
    expect(changes).toEqual([{ field: 'Name', from: '—', to: 'New' }]);
  });

  it('renders an object compactly instead of [object Object]', () => {
    const changes = fieldChanges(entry({
      before: { pricing_config: { mode: 'single' } },
      after: { pricing_config: { mode: 'size' } },
    }));
    expect(changes[0].from).toBe('{"mode":"single"}');
    expect(changes[0].to).toBe('{"mode":"size"}');
  });

  it('truncates a very large value rather than filling the row', () => {
    const big = { items: Array.from({ length: 200 }, (_, i) => `item-${i}`) };
    const changes = fieldChanges(entry({ before: {}, after: big }));
    expect(changes[0].to.length).toBeLessThanOrEqual(120);
    expect(changes[0].to.endsWith('…')).toBe(true);
  });

  it('returns nothing when there is nothing to show', () => {
    expect(fieldChanges(entry())).toEqual([]);
  });
});

describe('bookkeeping timestamps are never the story', () => {
  it('hides updated_at, which is not what changed', () => {
    // A product save reported "Updated At 22:40 → 22:47" as the headline
    // change, beside a When column already saying so in another timezone.
    expect(fieldChanges(entry({
      before: { updated_at: '2026-09-02T22:40:30Z' },
      after: { updated_at: '2026-09-02T22:47:42Z' },
    }))).toEqual([]);
  });

  it('keeps the real change when a timestamp moved alongside it', () => {
    const changes = fieldChanges(entry({
      before: { price: 5000, updated_at: 'a' },
      after: { price: 5500, updated_at: 'b' },
    }));
    expect(changes).toEqual([{ field: 'Price', from: '5000', to: '5500' }]);
  });
});

describe('changeSummary', () => {
  it('reads a single change in full', () => {
    expect(changeSummary(entry({ before: { stock: 14 }, after: { stock: 13 } })))
      .toBe('Stock 14 → 13');
  });

  it('counts several rather than stacking them in a cell', () => {
    expect(changeSummary(entry({
      before: { price: 1, stock: 2, name: 'a' },
      after: { price: 3, stock: 4, name: 'b' },
    }))).toBe('3 fields changed');
  });

  it('is a dash when nothing field-level was recorded', () => {
    expect(changeSummary(entry())).toBe('—');
    expect(changeSummary(entry({ before: { updated_at: 'a' }, after: { updated_at: 'b' } }))).toBe('—');
  });
});

describe('needsFailureBadge', () => {
  it('is false when the action label already says it failed', () => {
    // "Sign-in refused" followed by "Failed 401" said the same thing twice.
    for (const action of ['login_failed', 'login_throttled', 'reject']) {
      expect(needsFailureBadge(entry({ action, status_code: 401 })), action).toBe(false);
    }
  });

  it('is true for an action whose label does not imply failure', () => {
    expect(needsFailureBadge(entry({ action: 'status_change', status_code: 500 }))).toBe(true);
    expect(needsFailureBadge(entry({ action: 'update', status_code: 403 }))).toBe(true);
  });

  it('is false for a successful request', () => {
    expect(needsFailureBadge(entry({ action: 'update', status_code: 200 }))).toBe(false);
  });
});

describe('summarise and isFailedAttempt', () => {
  it('reads as one line', () => {
    expect(summarise(entry({ action: 'stock_change', entity_type: 'product_variant', entity_id: 'p:S|red' })))
      .toBe('Stock changed · Variant S|red');
  });

  it('marks a failed attempt, which is recorded on purpose', () => {
    expect(isFailedAttempt(entry({ status_code: 403 }))).toBe(true);
    expect(isFailedAttempt(entry({ status_code: 500 }))).toBe(true);
    expect(isFailedAttempt(entry({ status_code: 200 }))).toBe(false);
    expect(isFailedAttempt(entry({ status_code: null }))).toBe(false);
  });
});
