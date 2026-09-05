/** ADMIN layer — the bulk controls for the orders list.
 *
 * Only statuses every selected order can actually move to are offered: the
 * same forward-only, delivery-method-aware rule the single-order dropdown
 * uses, intersected across the selection. Picking a mixed batch with nothing
 * in common disables the control and says so, rather than sending a request
 * that would fail row by row.
 */
'use client';

import { useEffect, useState } from 'react';
import { Button, Select } from '@/components/ui';
import type { Order } from '@/types/order';
import { commonStatusOptions, formatOrderStatus } from '@/lib/commerce/order-status';
import BulkActionBar from '../../components/BulkActionBar';
import type { PendingBulkAction } from '../../hooks/useBulkAction';

interface OrdersBulkBarProps {
  selectedOrders: Order[];
  pending: PendingBulkAction | null;
  running: boolean;
  onApply: (ids: string[], status: Order['status']) => void;
  onUndo: () => void;
  onApplyNow: () => void;
  onClear: () => void;
}

export default function OrdersBulkBar({
  selectedOrders,
  pending,
  running,
  onApply,
  onUndo,
  onApplyNow,
  onClear,
}: OrdersBulkBarProps) {
  const options = commonStatusOptions(selectedOrders);
  const [status, setStatus] = useState('');

  // The selection changes what is offerable, so a status that is no longer on
  // the list must not stay armed behind a disabled-looking control.
  useEffect(() => {
    setStatus((current) => (options.includes(current as Order['status']) ? current : ''));
  }, [options.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BulkActionBar
      count={selectedOrders.length}
      pending={pending}
      running={running}
      onUndo={onUndo}
      onApplyNow={onApplyNow}
      onClear={onClear}
    >
      {options.length === 0 ? (
        <p className="text-body-sm text-text-secondary">
          These orders have no status change in common — they are already finished, or they mix
          pickup and delivery.
        </p>
      ) : (
        <>
          <Select
            size="sm"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-48"
            aria-label="Status to apply to the selected orders"
          >
            <option value="">Change status to…</option>
            {options.map((option) => (
              <option key={option} value={option}>{formatOrderStatus(option)}</option>
            ))}
          </Select>

          <Button
            size="sm"
            disabled={!status}
            onClick={() => onApply(selectedOrders.map((order) => order.id), status as Order['status'])}
          >
            Apply to {selectedOrders.length}
          </Button>

          <span className="text-caption-md text-text-secondary">
            Customers are notified, as with a single change.
          </span>
        </>
      )}
    </BulkActionBar>
  );
}
