/** STOREFRONT layer — form for a customer's reschedule request. */
'use client';

import { useState } from 'react';
import { Modal, Button, Input, Textarea } from '@/components/ui';
import { useOrderChangeRequest } from './hooks/useOrderChangeRequest';

interface RescheduleRequestFormProps {
  orderNumber: string;
  contact: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function RescheduleRequestForm({ orderNumber, contact, onClose, onSubmitted }: RescheduleRequestFormProps) {
  const [preferredDate, setPreferredDate] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const { submitChangeRequest, submitting, error } = useOrderChangeRequest();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await submitChangeRequest({
      orderNumber,
      contact,
      requestType: 'reschedule',
      details: { preferredDate },
      customerNote: customerNote.trim() || undefined,
    });
    if (ok) onSubmitted();
  };

  return (
    <Modal open onClose={onClose} title="Request Reschedule" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-body-sm font-medium text-text-primary mb-1.5">Preferred Date</label>
          <Input
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            required
          />
        </div>
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
          <Button type="submit" loading={submitting} disabled={!preferredDate} className="flex-1 font-semibold">
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
