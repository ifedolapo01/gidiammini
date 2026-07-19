/** ADMIN layer — delete confirmation modal for the products list page. */
import { Button, Modal } from '@/components/ui';

interface DeleteProductModalProps {
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteProductModal({ isDeleting, onCancel, onConfirm }: DeleteProductModalProps) {
  return (
    <Modal open onClose={onCancel} title="Delete Product" size="md">
      <p className="text-text-secondary mb-6">
        Are you sure you want to delete this product? This action cannot be undone and will remove all variants associated with it.
      </p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={isDeleting}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm} loading={isDeleting}>
          Delete Product
        </Button>
      </div>
    </Modal>
  );
}
