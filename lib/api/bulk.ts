/**
 * API layer — running one admin action over many rows in a single request.
 *
 * Two rules the callers depend on:
 *
 *   1. A failure on one row does not abandon the rest. Half a courier batch
 *      marked shipped and no indication of which half is worse than either
 *      outcome on its own, so every row is attempted and every row reports.
 *   2. The response names the rows that failed and why. A bulk endpoint that
 *      answers `{ success: false }` for 1 bad row out of 60 tells the operator
 *      nothing they can act on.
 *
 * Rows are attempted a few at a time rather than all at once: the underlying
 * writes take row locks (set_variant_stock, adjust_order_stock) and send mail,
 * and a burst of 50 concurrent transitions is how a bulk action turns into a
 * lock pile-up.
 */

export interface BulkRowResult {
  id: string;
  ok: boolean;
  /** Something the operator can recognise the row by — an order number, a
   * product name. Ids alone make a failure list unreadable. */
  label?: string;
  error?: string;
}

export interface BulkOutcome {
  results: BulkRowResult[];
  succeeded: number;
  failed: number;
}

/** How many rows one request may touch. Large enough for "select the page",
 * small enough to finish inside the route's time budget. */
export const MAX_BULK_ROWS = 50;

const CONCURRENCY = 4;

/**
 * Validates the `ids` array off a bulk request body.
 * Returns null when the payload is unusable, so the route can answer 400 with
 * its own message rather than guessing at an empty result.
 */
export function parseBulkIds(raw: unknown, max: number = MAX_BULK_ROWS): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const ids: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!ids.includes(trimmed)) ids.push(trimmed);
  }

  return ids.length > max ? null : ids;
}

/** What a per-row handler may return instead of throwing. */
export type BulkRowHandler = (id: string) => Promise<{ ok: boolean; label?: string; error?: string } | void>;

export async function runBulk(ids: string[], handle: BulkRowHandler): Promise<BulkOutcome> {
  const results: BulkRowResult[] = new Array(ids.length);
  let next = 0;

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= ids.length) return;

      const id = ids[index];
      try {
        const outcome = await handle(id);
        results[index] = outcome
          ? { id, ok: outcome.ok, label: outcome.label, error: outcome.error }
          : { id, ok: true };
      } catch (error: any) {
        // A thrown handler is still a per-row result, never a failed request:
        // the rows already written stay written and must be reported as such.
        results[index] = { id, ok: false, error: error?.message || 'Unexpected error' };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));

  const succeeded = results.filter((result) => result.ok).length;
  return { results, succeeded, failed: results.length - succeeded };
}
