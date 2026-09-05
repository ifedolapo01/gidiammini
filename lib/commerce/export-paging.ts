/**
 * COMMERCE layer — reading an entire table for an export.
 *
 * PostgREST answers at most 1000 rows per request whatever the query asks for,
 * silently. An export written as a single select therefore looks like it works
 * and quietly truncates the shop's history at row 1000 — the worst possible
 * failure for a file somebody is about to reconcile against a bank statement.
 *
 * So exports page explicitly, and stop at a cap rather than never. The cap is
 * reported back so the caller can say the file is partial instead of letting it
 * pass for complete.
 */
import type { PostgrestError } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;

/** How many rows one export may contain. Beyond this the answer is a date
 * range, not a bigger file. */
export const EXPORT_ROW_CAP = 50_000;

export interface PagedResult<T> {
  rows: T[];
  /** True when the cap stopped the read before the data ran out. */
  truncated: boolean;
}

type PageFetcher<T> = (
  from: number,
  to: number
) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;

export async function fetchAllRows<T>(
  fetchPage: PageFetcher<T>,
  cap: number = EXPORT_ROW_CAP
): Promise<PagedResult<T>> {
  const rows: T[] = [];

  while (rows.length < cap) {
    const from = rows.length;
    const to = Math.min(from + PAGE_SIZE, cap) - 1;

    const { data, error } = await fetchPage(from, to);
    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);

    // A short page means the data ran out, which is the only clean way to know.
    if (page.length < to - from + 1) return { rows, truncated: false };
  }

  return { rows, truncated: true };
}
