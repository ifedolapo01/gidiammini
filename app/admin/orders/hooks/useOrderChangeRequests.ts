/** ADMIN layer — approve/reject mutation for customer-submitted order change
 * requests, split out of useOrders.ts to keep that file under the project's
 * line-count cap, mirroring useOrderShippingUpdate.ts. Approving can change the
 * order's status or shipping fields (via the same commerce transitions the
 * admin's manual controls use), so on success this re-syncs the full order
 * from the server rather than guessing at the new fields locally. */
'use client';

import { useState } from 'react';
import { notifyOrdersChanged } from '../../lib/orderEvents';
import { describeDelivery } from '@/lib/notifications/delivery';

interface UseOrderChangeRequestsParams {
  /** Re-reads the list, the totals and the open order from the server. */
  onResolved: () => void | Promise<void>;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function useOrderChangeRequests({ onResolved, showToast }: UseOrderChangeRequestsParams) {
  const [resolvingRequestId, setResolvingRequestId] = useState<string | null>(null);

  const resolveChangeRequest = async (
    requestId: string,
    decision: 'approved' | 'rejected',
    adminResponse?: string
  ) => {
    try {
      setResolvingRequestId(requestId);
      const response = await fetch(`/api/orders/change-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, adminResponse }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        notifyOrdersChanged();
        await onResolved();
        const how = result.delivery ? describeDelivery(result.delivery) : 'No notification sent';
        showToast(
          `${decision === 'approved' ? 'Request approved' : 'Request rejected'}. ${how}.`,
          'success'
        );
      } else {
        showToast(`Failed to resolve request: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error: any) {
      console.error('Error resolving change request:', error);
      showToast(`Error resolving request: ${error.message || 'Please check your connection.'}`, 'error');
    } finally {
      setResolvingRequestId(null);
    }
  };

  return { resolveChangeRequest, resolvingRequestId };
}
