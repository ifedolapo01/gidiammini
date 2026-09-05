/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// components/track-order/TrackingDetails.tsx
//
// Where the parcel is, on the page the customer was already sent to.
//
// The tracking page has always shown a progress stepper, which says the order
// has shipped and nothing about how to find it. The waybill is the one piece
// of information a customer actually asks for after that point, and until the
// order carried one there was nothing to put here.
//
// Renders nothing at all when the order has no tracking. A "Tracking"
// heading over an empty box reads as information that failed to load, which
// produces exactly the message this is meant to prevent.
'use client';

import { ExternalLink, Truck } from 'lucide-react';
import { carrierName, hasTracking } from '@/lib/commerce/order-tracking';
import type { Order } from '@/types/order';

export default function TrackingDetails({ order }: { order: Order }) {
  const tracking = {
    carrier: order.carrier ?? null,
    trackingNumber: order.tracking_number ?? null,
    trackingUrl: order.tracking_url ?? null,
  };

  if (!hasTracking(tracking)) return null;

  const courier = carrierName(tracking.carrier);

  return (
    <div className="rounded-surface border border-border bg-surface p-4 shadow-elevation-1 md:p-6">
      <h3 className="mb-3 flex items-center gap-2 text-body-md font-bold text-text-primary md:mb-4 md:text-body-lg">
        <Truck className="size-5 shrink-0 text-info" aria-hidden="true" />
        Your parcel
      </h3>

      <dl className="space-y-2">
        {courier && (
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-body-sm text-text-secondary">Courier</dt>
            <dd className="text-body-sm font-medium text-text-primary md:text-body-md">{courier}</dd>
          </div>
        )}

        {tracking.trackingNumber && (
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-body-sm text-text-secondary">Tracking number</dt>
            {/* Selectable and monospaced: this gets read out on the phone and
                pasted into the courier's own site. */}
            <dd className="select-all font-mono text-body-sm font-medium text-text-primary md:text-body-md">
              {tracking.trackingNumber}
            </dd>
          </div>
        )}
      </dl>

      {tracking.trackingUrl && (
        <a
          href={tracking.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2.5 text-body-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          Track with {courier || 'the courier'}
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      )}

      {!tracking.trackingUrl && tracking.trackingNumber && (
        <p className="mt-3 text-caption-md text-text-secondary md:text-body-sm">
          Quote this number if you contact {courier || 'the courier'} directly.
        </p>
      )}
    </div>
  );
}
