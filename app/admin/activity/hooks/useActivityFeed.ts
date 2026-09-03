/**
 * ADMIN layer — reads the audit trail.
 *
 * Serves both surfaces: the filterable activity feed, and the per-entity
 * History tab on an order or product (which is the same query with
 * entity_type/entity_id fixed).
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AuditLogEntry } from '@/lib/commerce/audit-format';

export interface ActivityFilters {
  entity_type?: string;
  entity_id?: string;
  action?: string;
  actor_email?: string;
  since?: string;
  until?: string;
  /** Include the automatic per-request entries, which are a backstop rather
   * than something an operator normally wants to read. */
  include?: 'all';
}

interface UseActivityFeedOptions extends ActivityFilters {
  pageSize?: number;
  /** Skip fetching until the caller has what it needs (an id that arrives
   * asynchronously, a closed panel). */
  enabled?: boolean;
}

export function useActivityFeed({ pageSize = 50, enabled = true, ...filters }: UseActivityFeedOptions = {}) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Serialised, so the effect below depends on the filters' values rather than
  // on a fresh object identity every render.
  const key = JSON.stringify(filters);

  const load = useCallback(async (targetPage: number) => {
    if (!enabled) return;

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: String(pageSize) });
      for (const [field, value] of Object.entries(JSON.parse(key) as Record<string, string>)) {
        if (value) params.set(field, value);
      }

      const response = await fetch(`/api/admin/audit-log?${params}`);
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        setError(result?.error || 'Could not load activity. Please try again.');
        setEntries([]);
        return;
      }

      setEntries(result.entries ?? []);
      setTotal(result.total ?? 0);
      setPage(targetPage);
    } catch {
      setError('Could not reach the server. Please check your connection.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [key, pageSize, enabled]);

  useEffect(() => {
    // Filters changed, so any page beyond the first no longer means anything.
    load(0);
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return {
    entries,
    total,
    page,
    pageCount,
    loading,
    error,
    goToPage: load,
    reload: () => load(page),
  };
}
