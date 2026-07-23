/** ADMIN layer — stock-edit modal state and save flow for the stock management page. */
import { useState } from 'react';
import { toast } from 'sonner';
import { FlattenedProduct } from '@/lib/commerce/product-flatten';

export function useStockEditing(onSaved: () => void) {
  const [editingProduct, setEditingProduct] = useState<FlattenedProduct | null>(null);
  const [stockUpdates, setStockUpdates] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  const startEditing = (product: FlattenedProduct) => {
    setEditingProduct(product);
    setStockUpdates({
      ...stockUpdates,
      [product.id]: product.stock
    });
  };

  const saveChanges = async () => {
    if (!editingProduct) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/products/${editingProduct.productId}/stock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variantKey: editingProduct.variantKey,
          stock: stockUpdates[editingProduct.id]
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success('Stock updated successfully!');
          setEditingProduct(null);
          onSaved();
        }
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Failed to update stock');
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEditing = () => {
    setEditingProduct(null);
  };

  return {
    editingProduct,
    stockUpdates,
    setStockUpdates,
    startEditing,
    saveChanges,
    cancelEditing,
    isSaving,
  };
}
