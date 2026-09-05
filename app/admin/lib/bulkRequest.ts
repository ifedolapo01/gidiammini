/** ADMIN layer — posting a bulk action to the server.
 *
 * A page size can be 100 but one request may only carry MAX_BULK_ROWS: the
 * writes behind these take row locks and send mail, and a single request has a
 * time budget. Rather than refuse a selection the operator was allowed to
 * make, the ids are sent in server-sized batches and the per-row results are
 * merged back into one outcome — so the summary still names every row that
 * failed, whichever batch it was in.
 *
 * Batches run in sequence, not in parallel: the point of the server-side cap
 * is to bound concurrent work, and firing four batches at once would step
 * straight over it.
 */
import { MAX_BULK_ROWS, type BulkOutcome, type BulkRowResult } from '@/lib/api/bulk';

export async function postBulkBatched(
  url: string,
  ids: string[],
  body: Record<string, unknown>
): Promise<BulkOutcome> {
  const results: BulkRowResult[] = [];

  for (let start = 0; start < ids.length; start += MAX_BULK_ROWS) {
    const batch = ids.slice(start, start + MAX_BULK_ROWS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, ids: batch }),
      });

      const payload = await response.json().catch(() => null);

      if (Array.isArray(payload?.results)) {
        results.push(...payload.results);
        continue;
      }

      // A rejected batch (400, 500, or a body that is not the shape this
      // endpoint promises) is still an answer about those rows.
      const error = payload?.error || `Request failed (${response.status})`;
      results.push(...batch.map((id) => ({ id, ok: false, error })));
    } catch (caught: any) {
      results.push(...batch.map((id) => ({
        id,
        ok: false,
        error: caught?.message || 'Could not reach the server',
      })));
    }
  }

  const succeeded = results.filter((result) => result.ok).length;
  return { results, succeeded, failed: results.length - succeeded };
}
