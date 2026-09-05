/** ADMIN layer — everything the orders page needs, composed.
 *
 * This file used to hold the fetch, the 60-second full-history poll, the
 * status change, the notification form and the modal state. Each of those now
 * lives in its own hook; what is left here is the wiring, plus the one thing
 * that genuinely is shared — the reconcile callback every mutation runs, which
 * re-reads the current page, the totals and the open order together.
 */
'use client';

import { useCallback } from 'react';
import { useToast } from '../../hooks/useToast';
import { useOrdersList } from './useOrdersList';
import { useOrderDetails } from './useOrderDetails';
import { useOrderNotification } from './useOrderNotification';
import { useOrdersBulk } from './useOrdersBulk';
import { useOrderShippingUpdate } from './useOrderShippingUpdate';
import { useOrderChangeRequests } from './useOrderChangeRequests';

export function useOrders() {
  const { showToast } = useToast();

  const list = useOrdersList(showToast);
  const details = useOrderDetails(showToast);

  const { syncOrders } = list;
  const { refreshSelectedOrder, closeOrderDetails } = details;

  const reconcile = useCallback(async () => {
    await Promise.all([syncOrders(), refreshSelectedOrder()]);
  }, [syncOrders, refreshSelectedOrder]);

  const notification = useOrderNotification(showToast, closeOrderDetails);
  const bulk = useOrdersBulk(reconcile);
  const { updateOrderShipping, updatingShipping } = useOrderShippingUpdate({
    onUpdated: reconcile,
    showToast,
  });
  const { resolveChangeRequest, resolvingRequestId } = useOrderChangeRequests({
    onResolved: reconcile,
    showToast,
  });

  return {
    ...list,
    ...details,
    ...notification,
    bulk,
    updateOrderShipping,
    updatingShipping,
    resolveChangeRequest,
    resolvingRequestId,
  };
}
