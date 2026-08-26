/** ADMIN layer — shows an order's uploaded payment receipt in-app.
 *
 * The receipts bucket is private, so there is no URL to render directly. This
 * asks the admin-only endpoint for a short-lived signed URL when it opens, and
 * takes only the order id — the object path never reaches the browser. */
'use client';

import { useEffect, useState } from 'react';
import { Modal, Spinner, Button } from '@/components/ui';

interface ReceiptPreviewModalProps {
  orderId: string;
  onClose: () => void;
}

export function ReceiptPreviewModal({ orderId, onClose }: ReceiptPreviewModalProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setError(null);
      setUrl(null);
      try {
        const response = await fetch(`/api/admin/orders/${orderId}/receipt`);
        const result = await response.json().catch(() => null);
        if (!active) return;

        if (!response.ok || !result?.success) {
          setError(result?.error || 'Could not open the receipt.');
          return;
        }
        setUrl(result.url);
      } catch {
        if (active) setError('Could not reach the server to open the receipt.');
      }
    };

    load();
    return () => { active = false; };
  }, [orderId]);

  return (
    <Modal open onClose={onClose} title="Payment Receipt" size="lg" scrollable>
      {error ? (
        <div role="alert" className="p-4 bg-destructive-background border border-destructive-border rounded-control">
          <p className="text-destructive text-body-sm font-medium">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={onClose}>Close</Button>
        </div>
      ) : !url ? (
        <div className="flex items-center justify-center gap-3 py-16 text-text-secondary">
          <Spinner size="md" className="text-primary" />
          <span className="text-body-sm">Opening receipt…</span>
        </div>
      ) : (
        <img
          src={url}
          alt="Payment receipt"
          className="w-full h-auto max-h-[70vh] object-contain rounded-control"
          onError={() => setError('The receipt link expired. Close and reopen to try again.')}
        />
      )}
    </Modal>
  );
}
