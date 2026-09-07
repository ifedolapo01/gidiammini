/** STOREFRONT layer — form for swapping the size/colour of an item already on
 * the order. The new size/colour is free text, resolved against real stock
 * when the request is approved — see resolveRequestedVariant in
 * app/api/orders/change-requests/[id]/route.ts. */
'use client';

import { useState } from 'react';
import { Modal, Button, Input, Select, Textarea, FieldError, fieldErrorId } from '@/components/ui';
import { useOrderChangeRequest } from './hooks/useOrderChangeRequest';
import type { OrderItem } from '@/types/order';

interface ItemSwapFormProps {
  orderNumber: string;
  contact: string;
  orderItems: OrderItem[];
  onClose: () => void;
  onSubmitted: () => void;
}

/** One entry per distinct product on the order — a swap picks which product,
 *  not which line, since two lines of the same product are the same choice. */
function uniqueProducts(items: OrderItem[]) {
  const seen = new Map<string, OrderItem>();
  for (const item of items) {
    if (item.product_id && !seen.has(item.product_id)) seen.set(item.product_id, item);
  }
  return [...seen.values()];
}

export default function ItemSwapForm({ orderNumber, contact, orderItems, onClose, onSubmitted }: ItemSwapFormProps) {
  const products = uniqueProducts(orderItems);
  const [productId, setProductId] = useState(products[0]?.product_id ?? '');
  const [newSize, setNewSize] = useState('');
  const [newColor, setNewColor] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const { submitChangeRequest, submitting, error, fieldErrors } = useOrderChangeRequest();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await submitChangeRequest({
      orderNumber,
      contact,
      requestType: 'item_swap',
      details: { productId, newSize: newSize.trim() || undefined, newColor: newColor.trim() || undefined },
      customerNote: customerNote.trim() || undefined,
    });
    if (ok) onSubmitted();
  };

  return (
    <Modal open onClose={onClose} title="Swap an Item" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="swap-product" className="block text-body-sm font-medium text-text-primary mb-1.5">Which item?</label>
          <Select id="swap-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((item) => (
              <option key={item.product_id} value={item.product_id}>{item.product_name}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="swap-size" className="block text-body-sm font-medium text-text-primary mb-1.5">New size</label>
            <Input id="swap-size" value={newSize} onChange={(e) => setNewSize(e.target.value)} placeholder="e.g. 6-9m" />
          </div>
          <div>
            <label htmlFor="swap-color" className="block text-body-sm font-medium text-text-primary mb-1.5">New colour</label>
            <Input id="swap-color" value={newColor} onChange={(e) => setNewColor(e.target.value)} placeholder="e.g. Blue" />
          </div>
        </div>
        <p className="text-caption-md text-text-secondary">
          We&rsquo;ll check what&rsquo;s actually in stock before confirming. Leave whichever one isn&rsquo;t changing blank.
        </p>
        <div>
          <label htmlFor="swap-note" className="block text-body-sm font-medium text-text-primary mb-1.5">Note (optional)</label>
          <Textarea
            id="swap-note"
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            rows={2}
            invalid={!!fieldErrors.customerNote}
            aria-describedby={fieldErrors.customerNote ? fieldErrorId('customerNote') : undefined}
          />
          <FieldError id={fieldErrorId('customerNote')}>{fieldErrors.customerNote}</FieldError>
        </div>
        {error && <p className="text-body-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button
            type="submit"
            loading={submitting}
            disabled={!productId || (!newSize.trim() && !newColor.trim())}
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
