/** ADMIN layer — the receipt, beside the figure it has to match.
 *
 * The image and the expected amount are one component on purpose. The mistake
 * this whole screen exists to stop is verifying the wrong number, and that
 * happens when the amount is somewhere else on the page — remembered rather
 * than read. Here they cannot be looked at separately.
 *
 * Built for a phone first. This is the one admin task genuinely done standing
 * up with a banking app in the other hand, so the image gets the width, the
 * figures sit above it where a thumb is not covering them, and tapping the
 * image opens it full-size for the times a reference is too small to read.
 */
'use client';

import { useState } from 'react';
import { ImageOff, RefreshCw, ZoomIn } from 'lucide-react';
import { Button, Modal, Spinner } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { settlement } from '@/lib/commerce/payment-outcome';
import { useReceiptUrl } from '../../hooks/useReceiptUrl';
import type { PaymentQueueItem } from '@/types/payment';

interface ReceiptPaneProps {
  order: PaymentQueueItem;
}

export function ReceiptPane({ order }: ReceiptPaneProps) {
  const { url, loading, error, reload, reportExpired } = useReceiptUrl(
    order.receipt_path ? order.id : null
  );
  const [zoomed, setZoomed] = useState(false);
  const balance = settlement(order.total_amount, order.amount_paid);

  return (
    <div className="rounded-surface border border-border bg-surface">
      {/* The figures. Big, because they are read at arm's length against a
          phone screen in the other hand. */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-t-surface bg-border">
        <div className="bg-background-secondary px-4 py-3">
          <dt className="text-caption-md text-text-secondary">Expected</dt>
          <dd className="text-h5 font-bold tabular-nums text-text-primary">
            {formatCurrency(order.total_amount)}
          </dd>
        </div>
        <div className="bg-background-secondary px-4 py-3">
          <dt className="text-caption-md text-text-secondary">
            {balance.partial ? 'Balance owing' : 'Received so far'}
          </dt>
          <dd
            className={`text-h5 font-bold tabular-nums ${
              balance.partial ? 'text-warning' : 'text-text-primary'
            }`}
          >
            {formatCurrency(balance.partial ? balance.outstanding : order.amount_paid)}
          </dd>
        </div>
      </dl>

      <div className="p-3">
        {!order.receipt_path ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-text-secondary">
            <ImageOff className="size-8 text-text-muted" aria-hidden="true" />
            <p className="text-body-sm font-medium text-text-primary">No receipt uploaded</p>
            <p className="text-caption-md max-w-xs">
              Nothing to verify yet. Record a payment anyway if the money arrived by another
              route — cash, POS, or a transfer you found on the statement.
            </p>
          </div>
        ) : error ? (
          <div role="alert" className="rounded-control border border-destructive-border bg-destructive-background p-4">
            <p className="text-body-sm font-medium text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Reload receipt
            </Button>
          </div>
        ) : loading || !url ? (
          <div className="flex items-center justify-center gap-3 py-16 text-text-secondary">
            <Spinner size="md" className="text-primary" />
            <span className="text-body-sm">Opening receipt…</span>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setZoomed(true)}
              className="group relative block w-full overflow-hidden rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus"
              aria-label="Open the receipt full size"
            >
              {/* A raw <img> deliberately — the URL is a short-lived signature
                  over a private object, and the image optimiser would cache a
                  customer's bank receipt under a key that outlives it.
                  eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Payment receipt for order ${order.order_number}`}
                className="max-h-[60vh] w-full bg-background-tertiary object-contain"
                onError={reportExpired}
              />
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-caption-md text-white">
                <ZoomIn className="size-3.5" aria-hidden="true" />
                Tap to enlarge
              </span>
            </button>

            <button
              type="button"
              onClick={reload}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-control text-body-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Reload receipt
            </button>
          </div>
        )}
      </div>

      {zoomed && url && (
        <Modal open onClose={() => setZoomed(false)} title={`Receipt · ${order.order_number}`} size="lg" scrollable>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`Payment receipt for order ${order.order_number}`}
            className="h-auto w-full rounded-control object-contain"
            onError={reportExpired}
          />
        </Modal>
      )}
    </div>
  );
}
