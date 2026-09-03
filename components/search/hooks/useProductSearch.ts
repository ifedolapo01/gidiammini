/**
 * STOREFRONT layer — debounced product search.
 *
 * Serves the header typeahead and the results page from the same endpoint, so
 * the two can never disagree about what a query matches.
 *
 * Three things this handles that a bare fetch does not:
 *
 *   - Debouncing, so typing "sleepsuit" is one request rather than nine.
 *   - Out-of-order responses. A slow request for "sle" must not overwrite the
 *     results for "sleepsuit" typed after it, which is the classic typeahead
 *     bug: the list flickers back to a previous query's matches.
 *   - Abandoned requests, aborted on unmount so a closed dropdown does not set
 *     state on a gone component.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isSearchable, normaliseSearchQuery } from '@/lib/commerce/search-query';

export interface SearchProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  sub_category: string | null;
  main_image: string | null;
  stock: number;
  rank: number;
}

export interface CategorySuggestion {
  label: string;
  href: string;
}

const DEBOUNCE_MS = 250;

export function useProductSearch(query: string, limit = 8) {
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [categories, setCategories] = useState<CategorySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /** The query the current results belong to, so the UI can tell whether what
   * it is showing matches what is in the box. */
  const [resultsFor, setResultsFor] = useState('');

  /** Rejects a response that arrived after a newer request was made. */
  const latestRequest = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setProducts([]);
    setCategories([]);
    setError('');
    setResultsFor('');
  }, []);

  useEffect(() => {
    const normalised = normaliseSearchQuery(query);

    if (!isSearchable(query)) {
      setLoading(false);
      reset();
      return;
    }

    const timer = setTimeout(async () => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;

      const requestId = ++latestRequest.current;
      setLoading(true);
      setError('');

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(normalised)}&limit=${limit}`,
          { signal: abort.signal }
        );
        const result = await response.json().catch(() => null);

        // A newer keystroke has already fired; this answer is stale.
        if (requestId !== latestRequest.current) return;

        if (!response.ok || !result?.success) {
          setError(result?.error || 'Search is unavailable right now.');
          setProducts([]);
          setCategories([]);
          return;
        }

        setProducts(result.products ?? []);
        setCategories(result.categories ?? []);
        setResultsFor(normalised);
      } catch (fetchError: any) {
        if (fetchError?.name === 'AbortError') return;
        if (requestId !== latestRequest.current) return;
        setError('Could not reach the server.');
      } finally {
        if (requestId === latestRequest.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, limit, reset]);

  // Abort whatever is in flight when the component using this goes away.
  useEffect(() => () => controller.current?.abort(), []);

  return { products, categories, loading, error, resultsFor, reset };
}
