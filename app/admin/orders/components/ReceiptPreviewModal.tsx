/** ADMIN layer — shows an order's uploaded payment receipt in-app instead of
 * navigating to the raw storage URL in a new tab. */
'use client';

import { Modal } from '@/components/ui';

interface ReceiptPreviewModalProps {
  receiptUrl: string;
  onClose: () => void;
}

export function ReceiptPreviewModal({ receiptUrl, onClose }: ReceiptPreviewModalProps) {
  return (
    <Modal open onClose={onClose} title="Payment Receipt" size="lg" scrollable>
      <img
        src={receiptUrl}
        alt="Payment receipt"
        className="w-full h-auto max-h-[70vh] object-contain rounded-control"
      />
    </Modal>
  );
}
