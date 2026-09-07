/** ADMIN layer — the conversation on one order: loads it, sends into it, and
 * refetches on the same realtime doorbell + poll fallback the rest of the
 * admin already uses (see useAdminRealtime). */
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OrderMessage } from '@/types/orderMessage';
import { useAdminRealtime } from '../../hooks/useAdminRealtime';
import { adminFetch } from '@/app/admin/lib/admin-fetch';

const POLL_INTERVAL_MS = 20_000;

export function useOrderMessages(orderId: string) {
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async (options: { quiet?: boolean } = {}) => {
    if (!options.quiet) setLoading(true);
    try {
      const res = await adminFetch(`/api/orders/${orderId}/messages`);
      const data = await res.json();
      if (data.success) setMessages(data.messages);
    } finally {
      if (!options.quiet) setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshQuietly = useCallback(() => load({ quiet: true }), [load]);

  useAdminRealtime(['order_messages'], refreshQuietly);

  useEffect(() => {
    const interval = setInterval(refreshQuietly, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshQuietly]);

  const send = async (body: string): Promise<boolean> => {
    setSending(true);
    try {
      const res = await adminFetch(`/api/orders/${orderId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (data.success) {
        await load({ quiet: true });
        return true;
      }
      return false;
    } finally {
      setSending(false);
    }
  };

  return { messages, loading, sending, send };
}
