/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/stock/page.tsx
'use client';

import { RefreshCw } from 'lucide-react';
import { Button, Input, Spinner } from '@/components/ui';
import { useStock } from './hooks/useStock';
import { useStockEditing } from './hooks/useStockEditing';
import { StockSummaryCards } from './components/StockSummaryCards';
import { StockTable } from './components/StockTable';
import { StockEditModal } from './components/StockEditModal';

export default function StockManagementPage() {
  const {
    products,
    loading,
    refreshing,
    loadStock,
    refreshStock,
    lowStockThreshold,
    setLowStockThreshold,
    lowStockProducts,
    outOfStockProducts,
    mainProductsCount,
  } = useStock();

  const {
    editingProduct,
    stockUpdates,
    setStockUpdates,
    startEditing,
    saveChanges,
    cancelEditing,
    isSaving,
  } = useStockEditing(loadStock);

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Spinner size="xl" className="text-primary" />
            </div>
            <div className="text-body-lg text-text-secondary">Loading stock data...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-h4 md:text-h3 font-bold text-text-primary">Stock Management</h1>
          <p className="text-text-secondary mt-1">
            Manage product stock quantities
          </p>
        </div>

        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <div className="flex items-center gap-2">
            <label className="text-body-sm text-text-secondary">Low Stock Threshold:</label>
            <Input
              type="number" onFocus={(e) => e.target.select()}
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 5)}
              size="sm"
              className="w-20"
              min="1"
            />
          </div>
          <Button
            variant="outline"
            onClick={refreshStock}
            loading={refreshing}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      <StockSummaryCards
        mainProductsCount={mainProductsCount}
        totalVariations={products.length}
        lowStockCount={lowStockProducts.length}
        lowStockThreshold={lowStockThreshold}
        outOfStockCount={outOfStockProducts.length}
      />

      <StockTable products={products} lowStockThreshold={lowStockThreshold} onEdit={startEditing} />

      {/* Instructions */}
      <div className="mt-8 p-4 bg-info-background border border-info-border rounded-surface">
        <h3 className="font-bold text-info mb-2">How Stock Management Works:</h3>
        <ul className="text-body-sm text-info space-y-1">
          <li>• <strong>Stock automatically reduces</strong> when orders are confirmed</li>
          <li>• <strong>Stock automatically restores</strong> when confirmed orders are cancelled</li>
          <li>• <strong>Products with 0 stock are hidden</strong> from customer view</li>
          <li>• Click <strong>Update Stock</strong> to modify inventory numbers. To add completely new sizes or colors, use the main Edit Product page.</li>
        </ul>
      </div>

      {editingProduct && (
        <StockEditModal
          editingProduct={editingProduct}
          stockValue={stockUpdates[editingProduct.id] ?? editingProduct.stock}
          onStockChange={(value) => setStockUpdates({ ...stockUpdates, [editingProduct.id]: value })}
          onCancel={cancelEditing}
          onSave={saveChanges}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
