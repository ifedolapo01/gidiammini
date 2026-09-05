/** ADMIN layer — one order in the verification queue.
 *
 * Says the three things that decide whether to open it: how much is at stake,
 * how long the customer has already waited, and whether there is anything to
 * look at yet. An order with no receipt is dimmed rather than hidden — it is
 * still owed money, but it cannot be worked now and should not be competing
 * for attention with the ones that can.
 */
'use client';

import { Clock, FileImage, HandCoins } from 'lucide-react';
import { formatCurrency } from '@/lib/commerce/pricing';
import { daysWaiting, settlement } from '@/lib/commerce/payment-outcome';
import { cn } from '@/lib/utils';
import type { PaymentQueueItem } from '@/types/payment';

interface QueueRowProps {
  order: PaymentQueueItem;
  active: boolean;
  onSelect: (orderId: string) => void;
}

export function QueueRow({ order, active, onSelect }: QueueRowProps) {
  const waited = daysWaiting(order.created_at);
  const balance = settlement(order.total_amount, order.amount_paid);
  const actionable = Boolean(order.receipt_path) || balance.partial;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(order.id)}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'flex w-full items-center gap-3 border-l-2 px-3 py-3 text-left transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus',
          active
            ? 'border-l-primary bg-primary/10'
            : 'border-l-transparent hover:bg-surface-hover',
          !actionable && !active && 'opacity-60',
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-sm font-semibold text-text-primary">
            {order.customer_name}
          </p>
          <p className="truncate text-caption-md text-text-secondary">
            {order.order_number}
            {waited > 0 && (
              <>
                {' · '}
                <span className={waited >= 2 ? 'font-medium text-destructive' : 'text-warning'}>
                  waiting {waited}d
                </span>
              </>
            )}
          </p>

          <p className="mt-1 flex items-center gap-1.5 text-caption-md">
            {balance.partial ? (
              <>
                <HandCoins className="size-3.5 shrink-0 text-warning" aria-hidden="true" />
                <span className="text-warning">
                  {formatCurrency(balance.outstanding)} still owing
                </span>
              </>
            ) : order.receipt_path ? (
              <>
                <FileImage className="size-3.5 shrink-0 text-info" aria-hidden="true" />
                <span className="text-text-secondary">Receipt to check</span>
              </>
            ) : (
              <>
                <Clock className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                <span className="text-text-muted">No receipt yet</span>
              </>
            )}
          </p>
        </div>

        <span className="shrink-0 text-body-sm font-bold tabular-nums text-text-primary">
          {formatCurrency(order.total_amount)}
        </span>
      </button>
    </li>
  );
}
