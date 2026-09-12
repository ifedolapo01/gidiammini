/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/ReturnsPanel.tsx
//
// The returns tab: one card per return, each showing exactly the button its
// current status allows — see return-status.ts's RETURN_TRANSITIONS. Money
// only ever moves from the 'inspected' card's Restock action, which records a
// pending refund; settling it is done from the existing Refunds tab, not here.
'use client';

import { useState } from 'react';
import { Badge, Button, Input, Spinner, Textarea } from '@/components/ui';
import { formatDate } from '@/lib/commerce/format-date';
import { formatCurrency } from '@/lib/commerce/pricing';
import { fromMinorUnits, toMinorUnits } from '@/lib/commerce/money';
import { formatReturnStatus, getReturnStatusColorToken } from '@/lib/commerce/return-status';
import { useOrderReturns, type ReturnAction } from '../hooks/useOrderReturns';
import type { Return } from '@/types/return';
import type { OrderItem } from '@/types/order';

interface ReturnsPanelProps {
  orderId: string;
  orderItems: OrderItem[];
  showToast: (message: string, type?: 'success' | 'error') => void;
  onChanged: () => Promise<void> | void;
}

type ActHandler = (
  returnId: string,
  action: ReturnAction,
  options?: { adminResponse?: string; refundAmount?: number }
) => Promise<boolean>;

/** Sum of the returned lines' price × quantity — a starting point for the
 *  refund amount, never the final word: an admin can still adjust it before
 *  restocking. */
function defaultRefundAmount(ret: Return, orderItems: OrderItem[]): number {
  const byId = new Map(orderItems.filter((item) => item.id).map((item) => [item.id as string, item]));
  return (ret.return_items ?? []).reduce((sum, line) => {
    const item = byId.get(line.order_item_id);
    return sum + (item ? item.price * line.quantity : 0);
  }, 0);
}

function ReturnCard({
  ret,
  orderItems,
  saving,
  onAct,
}: {
  ret: Return;
  orderItems: OrderItem[];
  saving: boolean;
  onAct: ActHandler;
}) {
  const [adminResponse, setAdminResponse] = useState('');
  const [refundAmount, setRefundAmount] = useState(() => defaultRefundAmount(ret, orderItems));
  const byId = new Map(orderItems.filter((item) => item.id).map((item) => [item.id as string, item]));

  return (
    <div className="space-y-3 rounded-surface border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-text-primary">{ret.rma_number}</span>
        <Badge tone={getReturnStatusColorToken(ret.status)}>{formatReturnStatus(ret.status)}</Badge>
        <span className="text-caption-md text-text-secondary">Requested {formatDate(ret.requested_at)}</span>
      </div>

      <div className="space-y-1">
        {(ret.return_items ?? []).map((line) => (
          <p key={line.id} className="text-body-sm text-text-secondary">
            {byId.get(line.order_item_id)?.product_name ?? 'Item'} × {line.quantity}
            {line.restocked && <span className="ml-2 text-caption-md text-success">Restocked</span>}
          </p>
        ))}
      </div>

      <p className="text-body-sm text-text-secondary">Reason: {ret.reason}</p>
      {ret.admin_response && (
        <p className="text-body-sm text-text-secondary">Response sent: {ret.admin_response}</p>
      )}

      {(ret.status === 'requested' || ret.status === 'inspected') && (
        <div>
          <label className="mb-1.5 block text-body-sm font-medium text-text-primary">
            Response to customer (optional)
          </label>
          <Textarea value={adminResponse} onChange={(e) => setAdminResponse(e.target.value)} rows={2} />
        </div>
      )}

      {ret.status === 'inspected' && (
        <div>
          <label className="mb-1.5 block text-body-sm font-medium text-text-primary">
            Refund amount (₦): confirm before restocking
          </label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={fromMinorUnits(refundAmount)}
            onChange={(e) => setRefundAmount(Math.max(0, toMinorUnits(Number(e.target.value) || 0)))}
          />
          <p className="mt-1 text-caption-md text-text-secondary">
            Defaulted to the returned lines&rsquo; value ({formatCurrency(refundAmount)}).
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {ret.status === 'requested' && (
          <>
            <Button size="sm" disabled={saving} loading={saving} onClick={() => onAct(ret.id, 'approve', { adminResponse: adminResponse || undefined })}>
              Approve
            </Button>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => onAct(ret.id, 'reject', { adminResponse: adminResponse || undefined })}>
              Reject
            </Button>
          </>
        )}
        {ret.status === 'approved' && (
          <Button size="sm" disabled={saving} loading={saving} onClick={() => onAct(ret.id, 'receive')}>
            Mark Received
          </Button>
        )}
        {ret.status === 'received' && (
          <Button size="sm" disabled={saving} loading={saving} onClick={() => onAct(ret.id, 'inspect')}>
            Mark Inspected
          </Button>
        )}
        {ret.status === 'inspected' && (
          <>
            <Button size="sm" disabled={saving || refundAmount <= 0} loading={saving} onClick={() => onAct(ret.id, 'restock', { refundAmount })}>
              Restock &amp; Record Refund
            </Button>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => onAct(ret.id, 'reject', { adminResponse: adminResponse || undefined })}>
              Reject
            </Button>
          </>
        )}
        {ret.status === 'restocked' && (
          <p className="text-body-sm text-text-secondary">Settle the recorded refund from the Refunds tab.</p>
        )}
      </div>
    </div>
  );
}

export default function ReturnsPanel({ orderId, orderItems, showToast, onChanged }: ReturnsPanelProps) {
  const { returns, loading, error, saving, act } = useOrderReturns(orderId, showToast, onChanged);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-text-secondary">
        <Spinner size="sm" />
        <span className="text-body-sm">Loading returns…</span>
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-surface border border-destructive-border bg-destructive-background p-3 text-body-sm text-destructive">
        {error}
      </p>
    );
  }

  if (returns.length === 0) {
    return (
      <p className="rounded-surface border border-border bg-background-secondary p-3 text-body-sm text-text-secondary">
        No returns on this order.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {returns.map((ret) => (
        <ReturnCard key={ret.id} ret={ret} orderItems={orderItems} saving={saving} onAct={act} />
      ))}
    </div>
  );
}
