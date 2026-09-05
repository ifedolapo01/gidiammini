/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/OrderEditPanel.tsx
//
// The edit mode on an order: change a quantity, drop a line, swap a colour,
// apply a goodwill discount. Everything that has been happening over WhatsApp
// and then not being written down anywhere.
//
// The running total is labelled a preview, not a total, because it is one. The
// server recomputes it from the same lines inside edit_order_items(), and a
// browser figure presented as authoritative is a figure somebody will one day
// quote to a customer while the database says something else.
'use client';

import { Save, RotateCcw } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';
import type { Order } from '@/types/order';
import { formatCurrency } from '@/lib/commerce/pricing';
import { useOrderEdit } from '../hooks/useOrderEdit';
import OrderEditLineRow from './OrderEditLineRow';
import AddOrderLine from './AddOrderLine';

interface OrderEditPanelProps {
  order: Order;
  showToast: (message: string, type?: 'success' | 'error') => void;
  onSaved: () => Promise<void> | void;
}

/** Statuses past which the lines are a record rather than a plan — matching
 * the guard inside edit_order_items(), so the UI refuses for the same reasons
 * the database would rather than letting somebody discover it on Save. */
const LOCKED: Order['status'][] = ['cancelled', 'delivered', 'picked_up'];

export default function OrderEditPanel({ order, showToast, onSaved }: OrderEditPanelProps) {
  const edit = useOrderEdit(order, showToast, onSaved);

  if (LOCKED.includes(order.status)) {
    return (
      <div className="rounded-surface border border-border bg-background-secondary p-6 text-center">
        <p className="text-body-sm font-medium text-text-primary">
          This order is {order.status.replace('_', ' ')} and can no longer be edited.
        </p>
        <p className="mt-1 text-caption-md text-text-secondary">
          Its contents are a record of what happened. Issue a refund instead if money is owed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        {edit.lines.map((line) => (
          <OrderEditLineRow
            key={line.key}
            line={line}
            onChange={edit.updateLine}
            onRemove={edit.removeLine}
          />
        ))}

        {edit.lines.length === 0 && (
          <p className="rounded-surface border border-destructive-border bg-destructive-background p-3 text-body-sm text-destructive">
            An order must keep at least one item. Add one back, or cancel the order instead.
          </p>
        )}
      </div>

      <AddOrderLine onAdd={edit.addLine} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[9rem_1fr]">
        <div>
          <label htmlFor="edit-discount" className="mb-1 block text-caption-md text-text-secondary">
            Discount (₦)
          </label>
          <Input
            id="edit-discount"
            type="number"
            min={0}
            step={1}
            value={edit.discount}
            onChange={(event) => edit.setDiscount(Math.max(0, Math.round(Number(event.target.value) || 0)))}
          />
        </div>
        <div>
          <label htmlFor="edit-discount-reason" className="mb-1 block text-caption-md text-text-secondary">
            What the discount is for
          </label>
          <Input
            id="edit-discount-reason"
            value={edit.discountReason}
            onChange={(event) => edit.setDiscountReason(event.target.value)}
            placeholder="Agreed on the phone, late delivery…"
            disabled={edit.discount <= 0}
          />
        </div>
      </div>

      <dl className="rounded-surface border border-border p-3">
        <p className="mb-2 text-caption-md font-medium uppercase tracking-wide text-text-secondary">
          Preview — the server recalculates on save
        </p>
        {[
          ['Items', edit.preview.subtotal],
          ['Tax', edit.preview.tax],
          ['Delivery', edit.preview.shipping],
        ].map(([label, amount]) => (
          <div key={label as string} className="flex justify-between py-0.5 text-body-sm">
            <dt className="text-text-secondary">{label}</dt>
            <dd className="text-text-primary">{formatCurrency(amount as number)}</dd>
          </div>
        ))}
        {edit.discount > 0 && (
          <div className="flex justify-between py-0.5 text-body-sm">
            <dt className="text-text-secondary">Discount</dt>
            <dd className="text-success">-{formatCurrency(edit.discount)}</dd>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-border pt-2">
          <dt className="font-semibold text-text-primary">New total</dt>
          <dd className="text-body-lg font-bold text-text-primary">
            {formatCurrency(edit.preview.total)}
          </dd>
        </div>
      </dl>

      <div>
        <label htmlFor="edit-note" className="mb-1 block text-body-sm font-medium text-text-primary">
          Note to the customer (optional)
        </label>
        <Textarea
          id="edit-note"
          rows={2}
          value={edit.note}
          onChange={(event) => edit.setNote(event.target.value)}
          placeholder="Added to the email listing what changed."
        />
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={edit.notify}
          onChange={(event) => edit.setNotify(event.target.checked)}
          className="size-4 accent-[var(--primary)]"
        />
        <span className="text-body-sm text-text-primary">
          Email the customer what changed and what they now owe
        </span>
      </label>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={edit.reset} disabled={!edit.dirty || edit.saving}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Discard changes
        </Button>
        <Button onClick={edit.save} disabled={!edit.dirty || edit.lines.length === 0} loading={edit.saving}>
          <Save className="size-4" aria-hidden="true" />
          Save order
        </Button>
      </div>
    </div>
  );
}
