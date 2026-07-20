/** STOREFRONT layer — order number + email/phone lookup form. */
'use client';

import { Search } from 'lucide-react';
import { Button, Input } from '@/components/ui';

interface TrackOrderFormProps {
  orderNumber: string;
  setOrderNumber: (value: string) => void;
  contact: string;
  setContact: (value: string) => void;
  loading: boolean;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
}

export default function TrackOrderForm({
  orderNumber, setOrderNumber, contact, setContact, loading, error, onSubmit
}: TrackOrderFormProps) {
  return (
    <form onSubmit={onSubmit} className="bg-surface p-4 md:p-6 rounded-surface shadow-elevation-1 border border-border space-y-4">
      <div>
        <label className="block text-body-sm font-medium text-text-primary mb-1.5">Order Number</label>
        <Input
          type="text"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="e.g. UT88478504"
          required
        />
      </div>

      <div>
        <label className="block text-body-sm font-medium text-text-primary mb-1.5">Email or Phone Number</label>
        <Input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Whatever you used at checkout"
          required
        />
        <p className="text-caption-md text-text-muted mt-1">
          Used to confirm this order belongs to you.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-destructive-background text-destructive text-body-sm rounded-control border border-destructive-border">
          {error}
        </div>
      )}

      <Button type="submit" loading={loading} disabled={loading} className="w-full">
        <Search className="w-4 h-4" />
        Track Order
      </Button>
    </form>
  );
}
