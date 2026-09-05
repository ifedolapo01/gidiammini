/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/OrderTrackingCard.tsx
//
// Who has the parcel, and under what number — shown on the order, and editable
// in place.
//
// The edit is here rather than only on the ship dialog because a mistyped
// waybill is discovered after shipping, by definition: the customer says the
// link does not work. Without an inline fix the only options are a database
// edit or re-shipping an order that has already shipped, which would send a
// second "your order is on its way" email for a typo.
'use client';

import { useState } from 'react';
import { ExternalLink, Truck, Pencil } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import {
  CARRIERS,
  buildTrackingUrl,
  carrierName,
  carrierNeedsNumber,
  hasTracking,
} from '@/lib/commerce/order-tracking';
import type { Order } from '@/types/order';

interface OrderTrackingCardProps {
  order: Order;
  showToast: (message: string, type?: 'success' | 'error') => void;
  onSaved: () => Promise<void> | void;
}

export default function OrderTrackingCard({ order, showToast, onSaved }: OrderTrackingCardProps) {
  const current = {
    carrier: order.carrier ?? null,
    trackingNumber: order.tracking_number ?? null,
    trackingUrl: order.tracking_url ?? null,
  };

  const [editing, setEditing] = useState(false);
  const [carrier, setCarrier] = useState(current.carrier ?? '');
  const [number, setNumber] = useState(current.trackingNumber ?? '');
  const [url, setUrl] = useState(current.trackingUrl ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/orders/${order.id}/tracking`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrier: carrier || null,
          tracking_number: number || null,
          tracking_url: url || null,
        }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        showToast(result?.error || 'Could not save the tracking details.', 'error');
        return;
      }

      await onSaved();
      setEditing(false);
      showToast('Tracking updated. The customer was not re-notified.', 'success');
    } catch {
      showToast('Could not reach the server. Nothing was changed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="mb-6 space-y-3 rounded-surface border border-border p-3">
        <h3 className="font-semibold text-text-primary">Tracking</h3>

        <div>
          <label htmlFor="tracking-carrier" className="mb-1 block text-caption-md text-text-secondary">
            Courier
          </label>
          <Select
            id="tracking-carrier"
            value={carrier}
            onChange={(event) => setCarrier(event.target.value)}
          >
            <option value="">Not recorded</option>
            {CARRIERS.map((option) => (
              <option key={option.key} value={option.key}>{option.name}</option>
            ))}
          </Select>
        </div>

        {carrierNeedsNumber(carrier) && (
          <div>
            <label htmlFor="tracking-number" className="mb-1 block text-caption-md text-text-secondary">
              Waybill / tracking number
            </label>
            <Input
              id="tracking-number"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}

        <div>
          <label htmlFor="tracking-url" className="mb-1 block text-caption-md text-text-secondary">
            Tracking link
          </label>
          <Input
            id="tracking-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={buildTrackingUrl(carrier, number) ?? 'https://…'}
            autoComplete="off"
          />
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={save} loading={saving}>Save tracking</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-surface border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-text-primary">Tracking</h3>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          <Pencil className="size-4" aria-hidden="true" />
          {hasTracking(current) ? 'Edit' : 'Add'}
        </Button>
      </div>

      {!hasTracking(current) ? (
        <p className="mt-1 text-body-sm text-text-secondary">
          No courier recorded. Add one and the customer&rsquo;s emails will carry it.
        </p>
      ) : (
        <div className="mt-2 space-y-1">
          <p className="flex items-center gap-2 text-body-sm text-text-primary">
            <Truck className="size-4 text-text-secondary" aria-hidden="true" />
            {carrierName(current.carrier) || 'Courier not recorded'}
          </p>
          {current.trackingNumber && (
            <p className="font-mono text-body-sm text-text-primary">{current.trackingNumber}</p>
          )}
          {current.trackingUrl && (
            <a
              href={current.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-body-sm font-medium text-primary hover:underline"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              Open tracking page
            </a>
          )}
        </div>
      )}
    </div>
  );
}
