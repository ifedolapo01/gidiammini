/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/products/page.tsx - PRODUCTS LIST ONLY
'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Spinner } from '@/components/ui';
import { useProducts } from './list-hooks/useProducts';
import { ProductsTable } from './list-components/ProductsTable';
import { DeleteProductModal } from './list-components/DeleteProductModal';

export default function AdminProducts() {
  const {
    products,
    isLoading,
    error,
    deletingProduct,
    setDeletingProduct,
    isDeleting,
    executeDelete,
  } = useProducts();

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-h4 font-bold text-text-primary">Manage Products</h1>
          <p className="text-text-secondary">View and manage all your products</p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-control font-semibold hover:bg-primary-hover transition-colors"
        >
          <Plus size={20} />
          Add New Product
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive-background border border-destructive-border rounded-control">
          <p className="text-destructive font-medium">Error: {error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size="xl" className="text-primary" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border-strong rounded-surface">
          <div className="w-16 h-16 bg-background-tertiary rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
            </svg>
          </div>
          <h3 className="text-body-lg font-medium text-text-primary mb-2">No products yet</h3>
          <p className="text-text-secondary mb-6">Get started by adding your first product</p>
          <Link
            href="/admin/products/new"
            className="bg-primary text-primary-foreground px-6 py-3 rounded-control font-semibold hover:bg-primary-hover transition-colors inline-block"
          >
            Add First Product
          </Link>
        </div>
      ) : (
        <ProductsTable products={products} onDelete={setDeletingProduct} />
      )}

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
