/** STOREFRONT layer — form for a customer's pickup<->delivery switch request. */
'use client';

import { useState } from 'react';
import { Modal, Button, Input, Textarea } from '@/components/ui';
import { useOrderChangeRequest } from './hooks/useOrderChangeRequest';

interface DeliveryMethodChangeFormProps {
  orderNumber: string;
  contact: string;
  currentOption: 'pickup' | 'delivery';
  onClose: () => void;
  onSubmitted: () => void;
}

export default function DeliveryMethodChangeForm({
  orderNumber,
  contact,
  currentOption,
  onClose,
  onSubmitted,
}: DeliveryMethodChangeFormProps) {
  const newOption = currentOption === 'pickup' ? 'delivery' : 'pickup';
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [city, setCity] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const { submitChangeRequest, submitting, error } = useOrderChangeRequest();

  const needsAddress = newOption === 'delivery';
  const canSubmit = !needsAddress || (deliveryAddress.trim() && city.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await submitChangeRequest({
      orderNumber,
      contact,
      requestType: 'delivery_method_change',
      details: needsAddress
        ? { newDeliveryOption: newOption, deliveryAddress, city }
        : { newDeliveryOption: newOption },
      customerNote: customerNote.trim() || undefined,
    });
    if (ok) onSubmitted();
  };

  return (
    <Modal open onClose={onClose} title={`Switch to ${newOption === 'pickup' ? 'Pickup' : 'Delivery'}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {needsAddress && (
          <>
            <div>
              <label className="block text-body-sm font-medium text-text-primary mb-1.5">Delivery Address</label>
              <Input
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Street address"
                required
              />
            </div>
            <div>
              <label className="block text-body-sm font-medium text-text-primary mb-1.5">City/Town</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
          </>
        )}
        <div>
          <label className="block text-body-sm font-medium text-text-primary mb-1.5">Note (optional)</label>
          <Textarea
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            rows={3}
            placeholder="Anything we should know?"
          />
        </div>
        {error && <p className="text-body-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button type="submit" loading={submitting} disabled={!canSubmit} className="flex-1 font-semibold">
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
