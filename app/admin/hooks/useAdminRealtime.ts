/** ADMIN layer — "something changed in this table" from a websocket instead of
 * a poll.
 *
 * The events carry no data worth reading: the RLS grant behind them exposes
 * only a handful of non-identifying columns (see migration 20260905140100),
 * and the page refetches through the audited, paginated server API anyway. So
 * this hook is a doorbell — it reports that the table moved, and whether it is
 * currently connected.
 *
 * `connected` is the important half. Realtime can be unavailable for reasons
 * this app cannot fix — the socket drops, the project's connection limit is
 * reached, the migration has not been applied — and a page that silently
 * stopped updating is worse than one that polls. Callers use it to keep the
 * change-cursor poll running whenever the socket is not carrying the load.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getAdminRealtimeClient } from '@/lib/supabase/realtime-client';

/** Tables an admin browser is allowed to subscribe to. Anything else has no
 * policy behind it and would subscribe to silence. */
export type AdminRealtimeTable = 'orders' | 'product_variants';

export function useAdminRealtime(tables: AdminRealtimeTable[], onChange: () => void) {
  const [connected, setConnected] = useState(false);

  // Held in a ref so a new callback identity each render does not tear the
  // subscription down and build it again.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const key = tables.join(',');

  useEffect(() => {
    if (tables.length === 0) return;

    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    try {
      const supabase = getAdminRealtimeClient();
      channel = supabase.channel(`admin-changes:${key}`);

      for (const table of tables) {
        channel = channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          () => onChangeRef.current()
        );
      }

      channel.subscribe((status) => {
        if (cancelled) return;
        // CHANNEL_ERROR / TIMED_OUT / CLOSED all mean the same thing to the
        // caller: stop relying on this and keep polling.
        setConnected(status === 'SUBSCRIBED');
      });
    } catch (error) {
      console.error('Admin realtime unavailable; falling back to polling:', error);
      setConnected(false);
    }

    return () => {
      cancelled = true;
      setConnected(false);
      if (channel) void channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { connected };
}
