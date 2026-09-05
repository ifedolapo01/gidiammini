/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/ShipOrderDialog.tsx
//
// The prompt that turns "mark shipped" into a shipment.
//
// It appears on the transition rather than as a field somewhere on the order,
// because the moment the courier is handed the parcel is the only moment the
// waybill is in somebody's hand. A tracking field that has to be found and
// filled in later is a tracking field that stays empty.
//
// Nothing here is required. A parcel going out on the shop's own bike has no
// waybill, and refusing the status change for want of one would push the whole
// thing back outside the system — which is the problem, not the fix.
'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button, Modal, Input, Select } from '@/components/ui';
import {
  CARRIERS,
  buildTrackingUrl,
  carrierNeedsNumber,
  normaliseTrackingNumber,
} from '@/lib/commerce/order-tracking';
import type { TransitionExtras } from '../hooks/useStatusTransition';

interface ShipOrderDialogProps {
  order: { order_number: string };
  saving: boolean;
  onClose: () => void;
  onConfirm: (extras: TransitionExtras) => void;
}

export default function ShipOrderDialog({ order, saving, onClose, onConfirm }: ShipOrderDialogProps) {
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [notify, setNotify] = useState(true);

  const wantsNumber = carrierNeedsNumber(carrier);
  // What the customer would get if the operator adds nothing else. Shown so
  // they can see whether a link is already covered before pasting one.
  const derivedUrl = buildTrackingUrl(carrier, trackingNumber);
  const effectiveUrl = trackingUrl.trim() || derivedUrl;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onConfirm({
      carrier: carrier || undefined,
      tracking_number: normaliseTrackingNumber(trackingNumber) ?? undefined,
      tracking_url: trackingUrl.trim() || undefined,
      notify,
    });
  };

  return (
    <Modal open onClose={onClose} title={`Ship order ${order.order_number}`} size="lg" scrollable>
      <form onSubmit={submit} className="space-y-5">
        <p className="text-body-sm text-text-secondary">
          Whatever you enter here goes into the customer&rsquo;s shipping email and onto their
          tracking page. Leave it blank if there is nothing to track.
        </p>

        <div>
          <label htmlFor="ship-carrier" className="mb-1.5 block text-body-sm font-medium text-text-primary">
            Courier
          </label>
          <Select
            id="ship-carrier"
            value={carrier}
            onChange={(event) => setCarrier(event.target.value)}
          >
            <option value="">Not recorded</option>
            {CARRIERS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.name}
              </option>
            ))}
          </Select>
        </div>

        {wantsNumber && (
          <div>
            <label
              htmlFor="ship-tracking-number"
              className="mb-1.5 block text-body-sm font-medium text-text-primary"
            >
              Waybill / tracking number
            </label>
            <Input
              id="ship-tracking-number"
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
              placeholder="e.g. GIG4471829"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1 text-caption-md text-text-secondary">
              Spaces and dashes are stripped, so it matches however the customer types it back.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="ship-tracking-url" className="mb-1.5 block text-body-sm font-medium text-text-primary">
            Tracking link {derivedUrl ? '(optional — one is built for you)' : '(optional)'}
          </label>
          <Input
            id="ship-tracking-url"
            type="url"
            value={trackingUrl}
            onChange={(event) => setTrackingUrl(event.target.value)}
            placeholder={derivedUrl ?? 'https://…'}
            autoComplete="off"
          />
          <p className="mt-1 text-caption-md text-text-secondary">
            Most Nigerian couriers do not publish a stable tracking URL, so paste the link they gave
            you. Anything you paste wins over the generated one.
          </p>
        </div>

        {effectiveUrl && (
          <a
            href={effectiveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-body-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Check this link before sending it
          </a>
        )}

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={notify}
            onChange={(event) => setNotify(event.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          <span className="text-body-sm text-text-primary">Email and text the customer</span>
        </label>

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Mark shipped
          </Button>
        </div>
      </form>
    </Modal>
  );
}
