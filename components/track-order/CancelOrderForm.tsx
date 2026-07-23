/** STOREFRONT layer — form for a customer's cancel-order request. */
'use client';

import { useState } from 'react';
import { Modal, Button, Textarea } from '@/components/ui';
import { useOrderChangeRequest } from './hooks/useOrderChangeRequest';

interface CancelOrderFormProps {
  orderNumber: string;
  contact: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function CancelOrderForm({ orderNumber, contact, onClose, onSubmitted }: CancelOrderFormProps) {
  const [customerNote, setCustomerNote] = useState('');
  const { submitChangeRequest, submitting, error } = useOrderChangeRequest();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await submitChangeRequest({
      orderNumber,
      contact,
      requestType: 'cancel',
      details: {},
      customerNote: customerNote.trim() || undefined,
    });
    if (ok) onSubmitted();
  };

  return (
    <Modal open onClose={onClose} title="Cancel Order" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-body-sm text-text-secondary">
          We'll review your request and confirm the cancellation shortly.
        </p>
        <div>
          <label className="block text-body-sm font-medium text-text-primary mb-1.5">Reason (optional)</label>
          <Textarea
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            rows={3}
            placeholder="Let us know why, if you'd like"
          />
        </div>
        {error && <p className="text-body-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button type="submit" variant="destructive" loading={submitting} className="flex-1 font-semibold">
            Confirm Cancellation
          </Button>
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 font-semibold">
            Keep Order
          </Button>
        </div>
      </form>
    </Modal>
  );
}
