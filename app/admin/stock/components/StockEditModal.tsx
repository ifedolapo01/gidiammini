/** ADMIN layer — stock update modal for the stock management page. */
import { Package, Save } from 'lucide-react';
import { Button, Input, Modal } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import type { FlattenedProduct } from '@/lib/commerce/product-flatten';

interface StockEditModalProps {
  editingProduct: FlattenedProduct;
  stockValue: number;
  onStockChange: (value: number) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function StockEditModal({ editingProduct, stockValue, onStockChange, onCancel, onSave }: StockEditModalProps) {
  return (
    <Modal open onClose={onCancel} title="Update Stock" size="md" padded={false}>
      <div className="p-6">
        <div className="space-y-6">
          <div className="flex gap-4 items-start">
            {editingProduct.main_image ? (
              <div className="w-20 h-20 flex-shrink-0 rounded-control overflow-hidden border border-border shadow-elevation-1 bg-surface">
                <img
                  src={editingProduct.main_image}
                  alt={editingProduct.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-20 h-20 flex-shrink-0 bg-background-tertiary rounded-control flex items-center justify-center border border-border shadow-elevation-1">
                <Package className="w-10 h-10 text-text-muted" />
              </div>
            )}

            <div>
              <h3 className="text-body-lg font-bold text-text-primary">{editingProduct.name}</h3>
              <div className="mt-1 flex items-center gap-2">
                <span className="px-2 py-1 text-caption-md rounded-full bg-accent/10 text-accent font-medium">
                  {editingProduct.variantLabel}
                </span>
              </div>
              <p className="text-text-primary mt-2 font-medium">{formatCurrency(editingProduct.price)}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-border-light">
            <label className="block text-body-sm font-semibold text-text-primary mb-2">
              New Stock Quantity
            </label>
            <Input
              type="number" onFocus={(e) => e.target.select()}
              value={stockValue}
              onChange={(e) => onStockChange(parseInt(e.target.value) || 0)}
              size="lg"
              className="font-medium"
              min="0"
            />
            <p className="text-caption-md text-text-secondary mt-2">
              Current stock is {editingProduct.stock}. Updating this only affects the <strong>{editingProduct.variantLabel}</strong> variant.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-border bg-background-secondary flex justify-end gap-3 rounded-b-overlay">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSave}>
          <Save className="w-4 h-4" />
          Save Stock
        </Button>
      </div>
    </Modal>
  );
}
