/**
 * ADMIN layer — the data behind a moderation queue.
 *
 * One hook for both queues. Reviews and questions differ in what a decision
 * means and in what the card renders, and in nothing else: same paging, same
 * three statuses, same counts, same PATCH-then-reload, same DELETE. Written
 * twice they would have drifted within a month — the second one would get the
 * bug fix and the first would not.
 *
 * Reloads rather than patching the row in place. A status change moves an item
 * between the filter tabs and changes three of the counts; a local edit trying
 * to keep all of that in step is wrong by the second click.
 *
 * Mutations are optimistically *disabled*, never optimistically applied: the
 * row shows a pending state and its button a spinner, because publishing
 * something to a public product page is not a change to guess at.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

const PAGE_SIZE = 25;

/** The three statuses both resources share, plus the "no filter" option. */
export type ModerationStatus = 'pending' | 'published' | 'rejected';
export type ModerationFilter = ModerationStatus | 'all';

export type ModerationCounts = Record<ModerationStatus, number>;

const NO_COUNTS: ModerationCounts = { pending: 0, published: 0, rejected: 0 };

/** Which admin resource this queue is over. Also its API path. */
export type ModerationResource = 'reviews' | 'questions';

export function useModerationQueue<TItem extends { id: string }, TChange>(
  resource: ModerationResource,
  status: ModerationFilter
) {
  const [items, setItems] = useState<TItem[]>([]);
  const [counts, setCounts] = useState<ModerationCounts>(NO_COUNTS);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /** The id currently being written, so one row can show a pending state
   *  without disabling the whole list. */
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(PAGE_SIZE),
        });
        if (status !== 'all') params.set('status', status);

        const response = await fetch(`/api/admin/${resource}?${params}`);
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          setError(result?.error || `Could not load ${resource}. Please try again.`);
          setItems([]);
          return;
        }

        setItems(result.items ?? []);
        setCounts({ ...NO_COUNTS, ...(result.counts ?? {}) });
        setTotal(result.total ?? 0);
        setPage(targetPage);
      } catch {
        setError('Could not reach the server. Please check your connection.');
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [resource, status]
  );

  useEffect(() => {
    // The filter changed, so any page beyond the first no longer means anything.
    load(0);
  }, [load]);

  const moderate = useCallback(
    async (id: string, change: TChange, successMessage: string) => {
      setSaving(id);

      try {
        const response = await fetch(`/api/admin/${resource}/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(change),
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          // The route's own sentence, which for a refused publish explains the
          // rule rather than saying "failed".
          toast.error(result?.error || 'That change did not save.');
          return false;
        }

        toast.success(successMessage);
        await load(page);
        return true;
      } catch {
        toast.error('Could not reach the server.');
        return false;
      } finally {
        setSaving(null);
      }
    },
    [resource, load, page]
  );

  const remove = useCallback(
    async (id: string, successMessage: string) => {
      setSaving(id);

      try {
        const response = await fetch(`/api/admin/${resource}/${id}`, { method: 'DELETE' });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          toast.error(result?.error || 'That could not be deleted.');
          return false;
        }

        toast.success(successMessage);
        await load(page);
        return true;
      } catch {
        toast.error('Could not reach the server.');
        return false;
      } finally {
        setSaving(null);
      }
    },
    [resource, load, page]
  );

  return {
    items,
    counts,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    loading,
    error,
    saving,
    goToPage: load,
    reload: () => load(page),
    moderate,
    remove,
  };
}
