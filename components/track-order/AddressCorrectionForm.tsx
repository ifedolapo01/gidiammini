/** STOREFRONT layer — form for a customer's address-correction request. */
'use client';

import { useState } from 'react';
import { Modal, Button, Input, Textarea, FieldError, fieldErrorId } from '@/components/ui';
import { useOrderChangeRequest } from './hooks/useOrderChangeRequest';

interface AddressCorrectionFormProps {
  orderNumber: string;
  contact: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function AddressCorrectionForm({ orderNumber, contact, onClose, onSubmitted }: AddressCorrectionFormProps) {
  const [newAddress, setNewAddress] = useState('');
  const [city, setCity] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const { submitChangeRequest, submitting, error, fieldErrors } = useOrderChangeRequest();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await submitChangeRequest({
      orderNumber,
      contact,
      requestType: 'address_correction',
      details: { newAddress, city: city.trim() || undefined },
      customerNote: customerNote.trim() || undefined,
    });
    if (ok) onSubmitted();
  };

  return (
    <Modal open onClose={onClose} title="Correct Delivery Address" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="address-correction" className="block text-body-sm font-medium text-text-primary mb-1.5">Corrected Address</label>
          <Textarea
            id="address-correction"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            rows={3}
            placeholder="The full, corrected street address"
            invalid={!!fieldErrors.newAddress}
            aria-describedby={fieldErrors.newAddress ? fieldErrorId('newAddress') : undefined}
            required
          />
          <FieldError id={fieldErrorId('newAddress')}>{fieldErrors.newAddress}</FieldError>
        </div>
        <div>
          <label htmlFor="address-correction-city" className="block text-body-sm font-medium text-text-primary mb-1.5">
            City/Town <span className="font-normal text-text-secondary">(optional, if it also changed)</span>
          </label>
          <Input
            id="address-correction-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            invalid={!!fieldErrors.city}
            aria-describedby={fieldErrors.city ? fieldErrorId('city') : undefined}
          />
          <FieldError id={fieldErrorId('city')}>{fieldErrors.city}</FieldError>
        </div>
        <div>
          <label htmlFor="address-correction-note" className="block text-body-sm font-medium text-text-primary mb-1.5">Note (optional)</label>
          <Textarea
            id="address-correction-note"
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
          <Button type="submit" loading={submitting} disabled={!newAddress.trim()} className="flex-1 font-semibold">
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
