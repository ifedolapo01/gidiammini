import { describe, it, expect } from 'vitest';
import { parseBulkIds, runBulk, MAX_BULK_ROWS } from './bulk';

describe('parseBulkIds', () => {
  it('accepts a list of ids and drops duplicates', () => {
    expect(parseBulkIds(['a', 'b', 'a'])).toEqual(['a', 'b']);
  });

  it('trims, because a selection built from row keys can carry whitespace', () => {
    expect(parseBulkIds([' a '])).toEqual(['a']);
  });

  it('rejects anything the route should answer 400 for', () => {
    expect(parseBulkIds(undefined)).toBeNull();
    expect(parseBulkIds([])).toBeNull();
    expect(parseBulkIds('a')).toBeNull();
    expect(parseBulkIds([1])).toBeNull();
    expect(parseBulkIds([''])).toBeNull();
  });

  it('refuses a batch larger than one request should carry', () => {
    const tooMany = Array.from({ length: MAX_BULK_ROWS + 1 }, (_, index) => `id-${index}`);
    expect(parseBulkIds(tooMany)).toBeNull();
    expect(parseBulkIds(tooMany.slice(0, MAX_BULK_ROWS))).toHaveLength(MAX_BULK_ROWS);
  });
});

describe('runBulk', () => {
  it('reports a result for every row, in the order they were given', async () => {
    const outcome = await runBulk(['a', 'b', 'c'], async (id) => ({ ok: true, label: id.toUpperCase() }));

    expect(outcome.results.map((result) => result.id)).toEqual(['a', 'b', 'c']);
    expect(outcome.results.map((result) => result.label)).toEqual(['A', 'B', 'C']);
    expect(outcome).toMatchObject({ succeeded: 3, failed: 0 });
  });

  it('carries on past a failed row rather than abandoning the batch', async () => {
    // Half a courier batch marked shipped with no indication of which half is
    // worse than either outcome on its own.
    const outcome = await runBulk(['ok-1', 'bad', 'ok-2'], async (id) =>
      id === 'bad' ? { ok: false, label: 'GM-2', error: 'Already cancelled' } : { ok: true }
    );

    expect(outcome).toMatchObject({ succeeded: 2, failed: 1 });
    expect(outcome.results[1]).toEqual({ id: 'bad', ok: false, label: 'GM-2', error: 'Already cancelled' });
  });

  it('turns a thrown handler into a failed row, not a failed request', async () => {
    const outcome = await runBulk(['a', 'b'], async (id) => {
      if (id === 'a') throw new Error('Database is on fire');
      return { ok: true };
    });

    expect(outcome.results[0]).toMatchObject({ id: 'a', ok: false, error: 'Database is on fire' });
    expect(outcome.succeeded).toBe(1);
  });

  it('treats a handler that returns nothing as a success', async () => {
    const outcome = await runBulk(['a'], async () => undefined);
    expect(outcome).toMatchObject({ succeeded: 1, failed: 0 });
  });

  it('does not run every row at once', async () => {
    // The writes behind these take row locks and send mail; 50 at a time is
    // how a bulk action becomes a lock pile-up.
    let inFlight = 0;
    let peak = 0;

    await runBulk(
      Array.from({ length: 20 }, (_, index) => `id-${index}`),
      async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
        return { ok: true };
      }
    );

    expect(peak).toBeLessThanOrEqual(4);
  });

  it('handles an empty batch without hanging', async () => {
    await expect(runBulk([], async () => ({ ok: true }))).resolves.toMatchObject({
      succeeded: 0,
      failed: 0,
    });
  });
});
