/** STOREFRONT layer — form for a customer's return request. Only offered once
 * the order has actually been delivered, within the return window — see
 * canRequestReturn in lib/commerce/order-status.ts. */
'use client';

import { useState } from 'react';
import { Modal, Button, Checkbox, Textarea, FieldError, fieldErrorId } from '@/components/ui';
import { useReturnRequest } from './hooks/useReturnRequest';
import type { OrderItem } from '@/types/order';

interface ReturnRequestFormProps {
  orderNumber: string;
  contact: string;
  orderItems: OrderItem[];
  onClose: () => void;
  onSubmitted: () => void;
}

export default function ReturnRequestForm({ orderNumber, contact, orderItems, onClose, onSubmitted }: ReturnRequestFormProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const { submitReturnRequest, submitting, error, fieldErrors } = useReturnRequest();

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Returns the full line quantity for each item picked — this form has no
    // per-line quantity control yet, so a partial-quantity return (supported
    // by the schema and lib/commerce/returns.ts) isn't reachable from here.
    const items = orderItems
      .filter((item) => item.id && selected.has(item.id))
      .map((item) => ({ orderItemId: item.id as string, quantity: item.quantity }));
    const ok = await submitReturnRequest({ orderNumber, contact, reason, items });
    if (ok) onSubmitted();
  };

  return (
    <Modal open onClose={onClose} title="Request a Return" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-body-sm font-medium text-text-primary mb-1.5">
            Which item(s) are you returning?
          </label>
          <div className="space-y-2">
            {orderItems.filter((item) => item.id).map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <Checkbox
                  id={`return-item-${item.id}`}
                  checked={selected.has(item.id!)}
                  onChange={() => toggle(item.id!)}
                />
                <label htmlFor={`return-item-${item.id}`} className="text-body-sm text-text-primary">
                  {item.product_name}
                  {(item.size || item.color) && (
                    <span className="text-text-secondary"> ({[item.size, item.color].filter(Boolean).join(', ')})</span>
                  )}
                  {' '}× {item.quantity}
                </label>
              </div>
            ))}
          </div>
          <FieldError id={fieldErrorId('items')}>{fieldErrors.items}</FieldError>
        </div>
        <div>
          <label htmlFor="return-reason" className="block text-body-sm font-medium text-text-primary mb-1.5">Why is it coming back?</label>
          <Textarea
            id="return-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            invalid={!!fieldErrors.reason}
            aria-describedby={fieldErrors.reason ? fieldErrorId('reason') : undefined}
            required
          />
          <FieldError id={fieldErrorId('reason')}>{fieldErrors.reason}</FieldError>
        </div>
        {error && <p className="text-body-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button
            type="submit"
            loading={submitting}
            disabled={selected.size === 0 || !reason.trim()}
            className="flex-1 font-semibold"
          >
            Submit Request
          </Button>
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 font-semibold">
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
