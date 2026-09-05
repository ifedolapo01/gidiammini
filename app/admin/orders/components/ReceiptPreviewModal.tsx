/** ADMIN layer — shows an order's uploaded payment receipt in-app.
 *
 * The receipts bucket is private, so there is no URL to render directly.
 * Asking for the short-lived signed URL is useReceiptUrl's job, shared with
 * the verification queue — this component is the modal around it, and nothing
 * else. Verifying a payment is not done here: that is
 * app/admin/payments, which records what was actually received. This stays for
 * the times somebody just wants to look at the image from the orders list. */
'use client';

import { Modal, Spinner, Button } from '@/components/ui';
import { useReceiptUrl } from '@/app/admin/hooks/useReceiptUrl';

interface ReceiptPreviewModalProps {
  orderId: string;
  onClose: () => void;
}

export function ReceiptPreviewModal({ orderId, onClose }: ReceiptPreviewModalProps) {
  const { url, error, reload, reportExpired } = useReceiptUrl(orderId);

  return (
    <Modal open onClose={onClose} title="Payment Receipt" size="lg" scrollable>
      {error ? (
        <div role="alert" className="p-4 bg-destructive-background border border-destructive-border rounded-control">
          <p className="text-destructive text-body-sm font-medium">{error}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={reload}>Try again</Button>
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          </div>
        </div>
      ) : !url ? (
        <div className="flex items-center justify-center gap-3 py-16 text-text-secondary">
          <Spinner size="md" className="text-primary" />
          <span className="text-body-sm">Opening receipt…</span>
        </div>
      ) : (
        /* Stays a raw <img>. The URL is a short-lived signature over a
           private object: routing it through the image optimiser would cache a
           derivative under a key that expires, and would put a copy of a
           customer's bank receipt in a public cache. One admin viewing one
           receipt is not a payload problem worth taking that on.
           eslint-disable-next-line @next/next/no-img-element */
        <img
          src={url}
          alt="Payment receipt"
          className="w-full h-auto max-h-[70vh] object-contain rounded-control"
          onError={reportExpired}
        />
      )}
    </Modal>
  );
}
