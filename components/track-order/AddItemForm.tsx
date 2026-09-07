/** STOREFRONT layer — form for adding another line of a product already on
 * this order (a different size/colour, or just more of it). Not a pick from
 * the whole catalogue — see AddItemDetails in types/orderChangeRequest.ts. */
'use client';

import { useState } from 'react';
import { Modal, Button, Input, Select, Textarea, FieldError, fieldErrorId } from '@/components/ui';
import { useOrderChangeRequest } from './hooks/useOrderChangeRequest';
import type { OrderItem } from '@/types/order';

interface AddItemFormProps {
  orderNumber: string;
  contact: string;
  orderItems: OrderItem[];
  onClose: () => void;
  onSubmitted: () => void;
}

function uniqueProducts(items: OrderItem[]) {
  const seen = new Map<string, OrderItem>();
  for (const item of items) {
    if (item.product_id && !seen.has(item.product_id)) seen.set(item.product_id, item);
  }
  return [...seen.values()];
}

export default function AddItemForm({ orderNumber, contact, orderItems, onClose, onSubmitted }: AddItemFormProps) {
  const products = uniqueProducts(orderItems);
  const [productId, setProductId] = useState(products[0]?.product_id ?? '');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [customerNote, setCustomerNote] = useState('');
  const { submitChangeRequest, submitting, error, fieldErrors } = useOrderChangeRequest();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await submitChangeRequest({
      orderNumber,
      contact,
      requestType: 'add_item',
      details: {
        productId,
        size: size.trim() || undefined,
        color: color.trim() || undefined,
        quantity: Number(quantity) || 1,
      },
      customerNote: customerNote.trim() || undefined,
    });
    if (ok) onSubmitted();
  };

  return (
    <Modal open onClose={onClose} title="Add Another Item" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-body-sm text-text-secondary">
          Add more of something already on this order — a different size, colour, or just another one.
          This will change what you owe; we&rsquo;ll confirm the new total with you.
        </p>
        <div>
          <label htmlFor="additem-product" className="block text-body-sm font-medium text-text-primary mb-1.5">Which product?</label>
          <Select id="additem-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((item) => (
              <option key={item.product_id} value={item.product_id}>{item.product_name}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="additem-size" className="block text-body-sm font-medium text-text-primary mb-1.5">Size</label>
            <Input id="additem-size" value={size} onChange={(e) => setSize(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label htmlFor="additem-color" className="block text-body-sm font-medium text-text-primary mb-1.5">Colour</label>
            <Input id="additem-color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label htmlFor="additem-quantity" className="block text-body-sm font-medium text-text-primary mb-1.5">Qty</label>
            <Input
              id="additem-quantity"
              type="number"
              min="1"
              max="20"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              invalid={!!fieldErrors.quantity}
              aria-describedby={fieldErrors.quantity ? fieldErrorId('quantity') : undefined}
            />
          </div>
        </div>
        <FieldError id={fieldErrorId('quantity')}>{fieldErrors.quantity}</FieldError>
        <div>
          <label htmlFor="additem-note" className="block text-body-sm font-medium text-text-primary mb-1.5">Note (optional)</label>
          <Textarea
            id="additem-note"
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
          <Button type="submit" loading={submitting} disabled={!productId} className="flex-1 font-semibold">
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
