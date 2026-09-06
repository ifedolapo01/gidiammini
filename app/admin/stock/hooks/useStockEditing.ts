/** ADMIN layer — stock-edit modal state and save flow for the stock management page.
 *
 * The save now carries *why* the number changed, not just what it changed to.
 * Without that the ledger records every edit as an unexplained adjustment,
 * which makes a delivery indistinguishable from a correction — and every
 * reorder point and aging figure built on top of it wrong in the same
 * direction. See lib/commerce/inventory-movements.ts.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { FlattenedProduct } from '@/lib/commerce/product-flatten';
import { DEFAULT_STOCK_EDIT_REASON, type StockEditReason } from '@/lib/commerce/inventory-movements';

export function useStockEditing(onSaved: () => void) {
  const [editingProduct, setEditingProduct] = useState<FlattenedProduct | null>(null);
  const [stockUpdates, setStockUpdates] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<StockEditReason>(DEFAULT_STOCK_EDIT_REASON);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const startEditing = (product: FlattenedProduct) => {
    setEditingProduct(product);
    setStockUpdates({
      ...stockUpdates,
      [product.id]: product.stock
    });
    // Reset per edit. Carrying "restock" over from the last variant is how a
    // correction ends up recorded as a delivery.
    setReason(DEFAULT_STOCK_EDIT_REASON);
    setNote('');
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
          stock: stockUpdates[editingProduct.id],
          movementReason: reason,
          // The same text serves the audit entry and the ledger note. A stock
          // take is worth very little without one.
          reason: note.trim() || null,
        }),
      });

      const result = await response.json().catch(() => null);

      // Previously an `if (response.ok)` with no else: a rejected save closed
      // nothing, said nothing, and left the admin looking at a spinner that had
      // stopped. A failed save has to say so.
      if (!response.ok || !result?.success) {
        toast.error(result?.error || 'Failed to update stock');
        return;
      }

      toast.success(result.message || 'Stock updated successfully!');
      setEditingProduct(null);
      onSaved();
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
    reason,
    setReason,
    note,
    setNote,
    startEditing,
    saveChanges,
    cancelEditing,
    isSaving,
  };
}
