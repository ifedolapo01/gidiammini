/**
 * ADMIN layer — a short-lived signed URL for one order's payment receipt.
 *
 * Extracted from ReceiptPreviewModal when the verification queue needed the
 * same three states (loading, a URL, an expired link) in a completely
 * different layout. The receipts bucket is private, so there is no path the
 * browser can render directly and the endpoint is the only way in — which
 * makes this the single place that knows how to ask.
 *
 * `reload` exists because the signature expires in a couple of minutes, which
 * is well within the time somebody spends comparing a receipt against their
 * banking app. Without it the image simply breaks and the only way back is to
 * close and reopen.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';

interface UseReceiptUrlResult {
  url: string | null;
  loading: boolean;
  error: string | null;
  /** Ask for a fresh signature — after an expiry, or on the operator's word. */
  reload: () => void;
  /** Report that the browser could not load the image we handed it. */
  reportExpired: () => void;
}

export function useReceiptUrl(orderId: string | null): UseReceiptUrlResult {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  const reportExpired = useCallback(() => {
    setUrl(null);
    setError('That receipt link expired. Reload it to look again.');
  }, []);

  useEffect(() => {
    if (!orderId) {
      setUrl(null);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setUrl(null);

    (async () => {
      try {
        const response = await fetch(`/api/admin/orders/${orderId}/receipt`);
        const result = await response.json().catch(() => null);
        if (!active) return;

        if (!response.ok || !result?.success) {
          setError(result?.error || 'Could not open the receipt.');
          return;
        }
        setUrl(result.url);
      } catch {
        if (active) setError('Could not reach the server to open the receipt.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [orderId, attempt]);

  return { url, loading, error, reload, reportExpired };
}
