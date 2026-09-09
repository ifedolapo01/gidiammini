/** ADMIN layer hook — the zero-result list and the synonyms that fix it. */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminFetch } from '@/app/admin/lib/admin-fetch';

export interface ZeroResultQuery {
  query: string;
  timesSearched: number;
  lastSearchedAt: string;
  hasSynonym: boolean;
}

export interface Synonym {
  id: string;
  term: string;
  expansion: string;
  createdAt: string;
}

interface ApiZeroResultRow {
  query: string;
  times_searched: number;
  last_searched_at: string;
  has_synonym: boolean;
}

interface ApiSynonymRow {
  id: string;
  term: string;
  expansion: string;
  created_at: string;
}

export function useSearchSynonyms() {
  const [zeroResults, setZeroResults] = useState<ZeroResultQuery[]>([]);
  const [synonyms, setSynonyms] = useState<Synonym[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingTerm, setSavingTerm] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await adminFetch('/api/admin/search');
      const payload = await response.json();

      if (!payload?.success) {
        setError(payload?.error ?? 'Could not load search data');
        return;
      }

      setZeroResults(
        (payload.zeroResults as ApiZeroResultRow[]).map((row) => ({
          query: row.query,
          timesSearched: row.times_searched,
          lastSearchedAt: row.last_searched_at,
          hasSynonym: row.has_synonym,
        }))
      );
      setSynonyms(
        (payload.synonyms as ApiSynonymRow[]).map((row) => ({
          id: row.id,
          term: row.term,
          expansion: row.expansion,
          createdAt: row.created_at,
        }))
      );
      setError('');
    } catch {
      setError('Could not load search data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addSynonym = async (term: string, expansion: string) => {
    setSavingTerm(term);
    try {
      const response = await adminFetch('/api/admin/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term, expansion }),
      });
      const payload = await response.json();

      if (!payload.success) {
        toast.error(payload.error ?? 'Could not save the synonym');
        return false;
      }

      toast.success(`"${term}" now also matches "${expansion}"`);
      await refresh();
      return true;
    } catch {
      toast.error('Could not save the synonym');
      return false;
    } finally {
      setSavingTerm(null);
    }
  };

  const deleteSynonym = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await adminFetch('/api/admin/search', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const payload = await response.json();

      if (!payload.success) {
        toast.error(payload.error ?? 'Could not delete the synonym');
        return;
      }

      await refresh();
    } catch {
      toast.error('Could not delete the synonym');
    } finally {
      setDeletingId(null);
    }
  };

  return {
    zeroResults,
    synonyms,
    loading,
    error,
    savingTerm,
    deletingId,
    addSynonym,
    deleteSynonym,
  };
}
