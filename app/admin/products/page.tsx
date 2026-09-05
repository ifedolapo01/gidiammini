/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/products/page.tsx - PRODUCTS LIST ONLY
//
// A view over one server-selected page of products. Filters, search and sort
// are query parameters; the catalogue-wide counts come from the summary
// endpoint; and the checkbox column plus the sticky bar turn "60 markdowns"
// into one action.
'use client';
import { ProductsSkeleton } from './components/ProductsSkeleton';

import { Plus, Upload } from 'lucide-react';
import Link from 'next/link';
import { useProducts } from './list-hooks/useProducts';
import { useProductCategories } from './hooks/useProductCategories';
import { ProductsTable } from './list-components/ProductsTable';
import { ProductsFilters } from './list-components/ProductsFilters';
import { ProductsBulkBar } from './list-components/ProductsBulkBar';
import { DeleteProductModal } from './list-components/DeleteProductModal';
import TablePagination from '../components/TablePagination';
import LiveIndicator from '../components/LiveIndicator';
import BulkResultSummary from '../components/BulkResultSummary';
import ExportButton from '../components/ExportButton';
import { useTableSelection } from '../hooks/useTableSelection';

function EmptyProducts({ filtered }: { filtered: boolean }) {
  return (
    <div className="text-center py-12 border-2 border-dashed border-border-strong rounded-surface">
      <div className="w-16 h-16 bg-background-tertiary rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
        </svg>
      </div>
      <h3 className="text-body-lg font-medium text-text-primary mb-2">
        {filtered ? 'No products match these filters' : 'No products yet'}
      </h3>
      <p className="text-text-secondary mb-6">
        {filtered ? 'Try a different search or filter.' : 'Get started by adding your first product'}
      </p>
      {!filtered && (
        <Link
          href="/admin/products/new"
          className="bg-primary text-primary-foreground px-6 py-3 rounded-control font-semibold hover:bg-primary-hover transition-colors inline-block"
        >
          Add First Product
        </Link>
      )}
    </div>
  );
}

export default function AdminProducts() {
  const {
    params,
    products,
    meta,
    summary,
    isLoading,
    error,
    live,
    deletingProduct,
    setDeletingProduct,
    isDeleting,
    executeDelete,
    bulk,
  } = useProducts();

  const { categories } = useProductCategories();
  const selection = useTableSelection(products.map((product) => product.id));

  const isFiltered = Boolean(params.search) || params.filters.category !== '' || params.filters.stock !== 'all';

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-h4 font-bold text-text-primary">Manage Products</h1>
          <p className="flex items-center gap-3 text-text-secondary" aria-live="polite">
            <span>{meta.total} product{meta.total !== 1 ? 's' : ''} match these filters</span>
            <LiveIndicator live={live} subject="products" />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton dataset="products" label="Export" />
          <Link
            href="/admin/products/import"
            className="flex items-center gap-2 rounded-control border border-border-strong px-4 py-3 text-body-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
          >
            <Upload size={18} />
            Import CSV
          </Link>
          <Link
            href="/admin/products/new"
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-control font-semibold hover:bg-primary-hover transition-colors"
          >
            <Plus size={20} />
            Add New Product
          </Link>
        </div>
      </div>

      <ProductsFilters
        search={params.search}
        onSearchChange={params.setSearch}
        filters={params.filters}
        onFilterChange={params.setFilter}
        sort={params.sort}
        direction={params.direction}
        onSortChange={params.setSort}
        categories={categories}
      />

      {error && (
        <div className="mb-6 p-4 bg-destructive-background border border-destructive-border rounded-control">
          <p className="text-destructive font-medium">Error: {error}</p>
        </div>
      )}

      {isLoading && products.length === 0 ? (
        <ProductsSkeleton />
      ) : products.length === 0 ? (
        <EmptyProducts filtered={isFiltered} />
      ) : (
        <ProductsTable
          products={products}
          selection={selection}
          summary={summary}
          onDelete={setDeletingProduct}
        >
          <TablePagination
            page={meta.page}
            pageCount={meta.totalPages}
            total={meta.total}
            loading={isLoading}
            onPageChange={params.setPage}
            limit={params.limit}
            onLimitChange={params.setLimit}
            itemNoun="products"
            label="Product pages"
          />
        </ProductsTable>
      )}

      <BulkResultSummary outcome={bulk.outcome} onDismiss={bulk.dismissOutcome} />

      <ProductsBulkBar
        selectedIds={selection.selectedIds}
        categories={categories}
        pending={bulk.pending}
        running={bulk.running}
        onSetActive={bulk.setActive}
        onMoveCategory={bulk.moveCategory}
        onAdjustPrice={bulk.adjustPrice}
        onUndo={bulk.undo}
        onApplyNow={bulk.applyNow}
        onClear={selection.clear}
      />

      {deletingProduct && (
        <DeleteProductModal
          isDeleting={isDeleting}
          onCancel={() => setDeletingProduct(null)}
          onConfirm={() => executeDelete(deletingProduct)}
        />
      )}
    </div>
  );
}
