/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/stock/page.tsx
//
// One server-selected page of stock rows. The summary cards are counted in the
// database, the low-stock threshold travels with the query so the filter and
// the card always agree, and the checkbox column turns a shelf count into one
// action instead of one modal per variant.
'use client';
import Link from 'next/link';
import { LineChart } from 'lucide-react';
import { StockSkeleton } from './components/StockSkeleton';

import { useStock } from './hooks/useStock';
import { useStockBulk } from './hooks/useStockBulk';
import { useStockEditing } from './hooks/useStockEditing';
import { useProductCategories } from '../products/hooks/useProductCategories';
import { useTableSelection } from '../hooks/useTableSelection';
import TablePagination from '../components/TablePagination';
import LiveIndicator from '../components/LiveIndicator';
import BulkResultSummary from '../components/BulkResultSummary';
import ExportButton from '../components/ExportButton';
import { StockSummaryCards } from './components/StockSummaryCards';
import { StockFilters } from './components/StockFilters';
import { StockTable } from './components/StockTable';
import { StockBulkBar } from './components/StockBulkBar';
import { StockEditModal } from './components/StockEditModal';
import { variantRef } from '@/lib/commerce/product-flatten';

export default function StockManagementPage() {
  const {
    params,
    products,
    meta,
    summary,
    loading,
    error,
    live,
    reconcile,
    lowStockThreshold,
    setLowStockThreshold,
    insights,
  } = useStock();

  const { categories } = useProductCategories();
  const selection = useTableSelection(products.map(variantRef));
  const bulk = useStockBulk(reconcile);

  const {
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
  } = useStockEditing(reconcile);

  const isFiltered = Boolean(params.search) || params.filters.category !== '' || params.filters.stock !== 'all';

  if (loading && products.length === 0) return <StockSkeleton />;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
        <h1 className="text-h4 md:text-h3 font-bold text-text-primary">Stock Management</h1>
        <p className="flex items-center gap-3 text-text-secondary mt-1" aria-live="polite">
          <span>{meta.total} product{meta.total !== 1 ? 's' : ''} match these filters</span>
          <LiveIndicator live={live} subject="stock levels" />
        </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Beside the export rather than in the sidebar: the reports answer
              questions that come up while looking at this table, and a nav
              entry of its own would put "what should I buy" three clicks from
              "what have I got". */}
          <Link
            href="/admin/stock/reports"
            className="inline-flex items-center gap-2 rounded-control border border-border px-4 py-2 text-body-sm font-medium text-text-primary hover:bg-surface-hover transition-colors"
          >
            <LineChart size={18} aria-hidden />
            Reorder &amp; aging
          </Link>
          {/* Exports the same variant_ref the bulk stock endpoint accepts, so a
              counted sheet can come back in. */}
          <ExportButton dataset="stock" label="Export stock" />
        </div>
      </div>

      <StockSummaryCards summary={summary} />

      <StockFilters
        search={params.search}
        onSearchChange={params.setSearch}
        filters={params.filters}
        onFilterChange={params.setFilter}
        sort={params.sort}
        direction={params.direction}
        onSortChange={params.setSort}
        categories={categories}
        lowStockThreshold={lowStockThreshold}
        onLowStockThresholdChange={setLowStockThreshold}
      />

      {error && (
        <div className="mb-6 p-4 bg-destructive-background border border-destructive-border rounded-control">
          <p className="text-destructive font-medium">Error: {error}</p>
        </div>
      )}

      <StockTable
        products={products}
        lowStockThreshold={lowStockThreshold}
        insights={insights}
        selection={selection}
        onEdit={startEditing}
        filtered={isFiltered}
      >
        <TablePagination
          page={meta.page}
          pageCount={meta.totalPages}
          total={meta.total}
          loading={loading}
          onPageChange={params.setPage}
          limit={params.limit}
          onLimitChange={params.setLimit}
          itemNoun="products"
          label="Stock pages"
        />
      </StockTable>

      <BulkResultSummary outcome={bulk.outcome} onDismiss={bulk.dismissOutcome} />

      {/* Instructions */}
      <div className="mt-8 p-4 bg-info-background border border-info-border rounded-surface">
        <h3 className="font-bold text-info mb-2">How Stock Management Works:</h3>
        <ul className="text-body-sm text-info space-y-1">
          <li>• <strong>Stock automatically reduces</strong> when orders are confirmed</li>
          <li>• <strong>Stock automatically restores</strong> when confirmed orders are cancelled</li>
          <li>• <strong>Products with 0 stock are hidden</strong> from customer view</li>
          <li>• Click <strong>Update Stock</strong> to modify one variant, or tick several and use the bar at the bottom to set them all at once. To add completely new sizes or colors, use the main Edit Product page.</li>
        </ul>
      </div>

      <StockBulkBar
        selectedIds={selection.selectedIds}
        pending={bulk.pending}
        running={bulk.running}
        onSetStock={bulk.setStock}
        onUndo={bulk.undo}
        onApplyNow={bulk.applyNow}
        onClear={selection.clear}
      />

      {editingProduct && (
        <StockEditModal
          editingProduct={editingProduct}
          stockValue={stockUpdates[editingProduct.id] ?? editingProduct.stock}
          onStockChange={(value) => setStockUpdates({ ...stockUpdates, [editingProduct.id]: value })}
          reason={reason}
          onReasonChange={setReason}
          note={note}
          onNoteChange={setNote}
          onCancel={cancelEditing}
          onSave={saveChanges}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
