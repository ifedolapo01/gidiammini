/** STOREFRONT layer — form for a customer's "hold my order" request. */
'use client';

import { useState } from 'react';
import { Modal, Button, Input, Textarea, FieldError, fieldErrorId } from '@/components/ui';
import { useOrderChangeRequest } from './hooks/useOrderChangeRequest';

interface HoldUntilFormProps {
  orderNumber: string;
  contact: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function HoldUntilForm({ orderNumber, contact, onClose, onSubmitted }: HoldUntilFormProps) {
  const [holdUntilDate, setHoldUntilDate] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const { submitChangeRequest, submitting, error, fieldErrors } = useOrderChangeRequest();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await submitChangeRequest({
      orderNumber,
      contact,
      requestType: 'hold_until',
      details: { holdUntilDate },
      customerNote: customerNote.trim() || undefined,
    });
    if (ok) onSubmitted();
  };

  return (
    <Modal open onClose={onClose} title="Hold My Order" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-body-sm text-text-secondary">
          We won&rsquo;t ship your order before this date.
        </p>
        <div>
          <label htmlFor="hold-date" className="block text-body-sm font-medium text-text-primary mb-1.5">Hold Until</label>
          <Input
            id="hold-date"
            type="date"
            value={holdUntilDate}
            onChange={(e) => setHoldUntilDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            invalid={!!fieldErrors.holdUntilDate}
            aria-describedby={fieldErrors.holdUntilDate ? fieldErrorId('holdUntilDate') : undefined}
            required
          />
          <FieldError id={fieldErrorId('holdUntilDate')}>{fieldErrors.holdUntilDate}</FieldError>
        </div>
        <div>
          <label htmlFor="hold-note" className="block text-body-sm font-medium text-text-primary mb-1.5">Note (optional)</label>
          <Textarea
            id="hold-note"
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            rows={2}
            placeholder="Why you need it held, if you'd like to say"
            invalid={!!fieldErrors.customerNote}
            aria-describedby={fieldErrors.customerNote ? fieldErrorId('customerNote') : undefined}
          />
          <FieldError id={fieldErrorId('customerNote')}>{fieldErrors.customerNote}</FieldError>
        </div>
        {error && <p className="text-body-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button type="submit" loading={submitting} disabled={!holdUntilDate} className="flex-1 font-semibold">
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
