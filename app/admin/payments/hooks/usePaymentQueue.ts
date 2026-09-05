/**
 * ADMIN layer — the verification queue, and which item is being worked.
 *
 * Owns three things a queue needs and a list does not:
 *
 *   * A cursor. There is always exactly one item open, because verification is
 *     a sequence rather than a browse — you work the top of the queue until it
 *     is empty.
 *   * Advance-on-decision. Clearing an item moves to the next one without a
 *     tap, which is the whole difference between a queue and a page you keep
 *     going back to.
 *   * A refetch that does not lose your place. Realtime and the poll both fire
 *     while somebody is mid-decision; the cursor is an order id, not an index,
 *     so a new order arriving at the top cannot silently swap what you are
 *     looking at.
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PaymentQueueItem } from '@/types/payment';
import { ADMIN_POLL_INTERVAL_MS } from '../../lib/adminPolling';
import { useAdminRealtime } from '../../hooks/useAdminRealtime';

export interface PaymentQueueSummary {
  waiting: number;
  withReceipt: number;
  partPaid: number;
  awaitingReceipt: number;
  capped: boolean;
}

const EMPTY_SUMMARY: PaymentQueueSummary = {
  waiting: 0,
  withReceipt: 0,
  partPaid: 0,
  awaitingReceipt: 0,
  capped: false,
};

interface UsePaymentQueueOptions {
  /**
   * An order to open on arrival, from `?order=` — how the dashboard worklist
   * hands off a specific receipt.
   *
   * Honoured once, and only if that order is actually still in the queue: a
   * link followed an hour later, after somebody else verified it, should land
   * on the front of the queue rather than on an empty panel.
   */
  preferredOrderId?: string | null;
}

export function usePaymentQueue({ preferredOrderId }: UsePaymentQueueOptions = {}) {
  const [items, setItems] = useState<PaymentQueueItem[]>([]);
  const [summary, setSummary] = useState<PaymentQueueSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Held in a ref so the fetch callback keeps one identity — it is a
  // dependency of the poll, the realtime subscription and every decision.
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;

  // Once honoured, the deep link stops competing with the operator's own
  // clicks and with advance-on-decision.
  const deepLinkUsed = useRef(false);

  const load = useCallback(async (options: { quiet?: boolean } = {}) => {
    if (!options.quiet) setLoading(true);

    try {
      const response = await fetch('/api/admin/payments/queue');
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Could not load the verification queue.');
      }

      const next: PaymentQueueItem[] = result.items ?? [];
      setItems(next);
      setSummary(result.summary ?? EMPTY_SUMMARY);
      setError(null);

      // The open item may have just been cleared by somebody else, or by the
      // decision that triggered this refetch. Fall to the front of the queue
      // rather than showing an empty panel.
      const stillThere = next.some((item) => item.id === selectedRef.current);

      if (!deepLinkUsed.current && preferredOrderId) {
        deepLinkUsed.current = true;
        const wanted = next.find((item) => item.id === preferredOrderId);
        setSelectedId(wanted?.id ?? next[0]?.id ?? null);
      } else if (!stillThere) {
        setSelectedId(next[0]?.id ?? null);
      }
    } catch (cause) {
      // A background refresh must not replace a working screen with an error.
      if (!options.quiet) {
        setError(cause instanceof Error ? cause.message : 'Could not load the verification queue.');
      }
    } finally {
      if (!options.quiet) setLoading(false);
    }
  }, [preferredOrderId]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshQuietly = useCallback(() => load({ quiet: true }), [load]);

  // A receipt uploaded from the storefront changes `orders`, so the queue grows
  // on its own. The poll behind the socket is the safety net — see
  // useAdminRealtime.
  const { connected: live } = useAdminRealtime(['orders'], refreshQuietly);

  useEffect(() => {
    const interval = setInterval(refreshQuietly, ADMIN_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshQuietly]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  /**
   * Move past the item just decided.
   *
   * Chosen before the refetch, from the list currently on screen: the next
   * item is the one the operator can see is next, not whatever the server
   * happens to return first once this one is gone.
   */
  const advance = useCallback(async () => {
    const index = items.findIndex((item) => item.id === selectedRef.current);
    const next = index >= 0 ? items[index + 1] ?? items[index - 1] ?? null : null;
    setSelectedId(next?.id ?? null);
    await load({ quiet: true });
  }, [items, load]);

  return {
    items,
    summary,
    loading,
    error,
    live,
    selected,
    selectedId,
    select: setSelectedId,
    advance,
    reload: load,
  };
}
