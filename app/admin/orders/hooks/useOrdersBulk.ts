/** ADMIN layer — one status change applied to every selected order.
 *
 * Marking a courier batch shipped was one modal per order. This schedules the
 * whole batch behind the shared undo window and sends it as a single request,
 * which answers with a per-row result: an order that could not move (already
 * cancelled, already delivered) is named rather than silently skipped.
 */
'use client';

import { useCallback } from 'react';
import type { Order } from '@/types/order';
import { formatOrderStatus } from '@/lib/commerce/order-status';
import { notifyOrdersChanged } from '../../lib/orderEvents';
import { useBulkAction } from '../../hooks/useBulkAction';
import { postBulkBatched } from '../../lib/bulkRequest';

export function useOrdersBulk(onApplied: () => void | Promise<void>) {
  const bulk = useBulkAction(() => {
    notifyOrdersChanged();
    void onApplied();
  });

  const applyStatus = useCallback(
    // reasonCode is required by the endpoint for 'cancelled' and ignored
    // otherwise — the bar collects it before enabling Apply, so a batch never
    // reaches the server without one.
    (ids: string[], status: Order['status'], reasonCode?: string) => {
      if (ids.length === 0) return;

      bulk.schedule({
        description: `Mark as ${formatOrderStatus(status)}`,
        count: ids.length,
        run: () =>
          postBulkBatched('/api/orders/bulk', ids, {
            status,
            sendNotification: true,
            reason_code: reasonCode,
          }),
      });
    },
    [bulk]
  );

  return { ...bulk, applyStatus };
}
