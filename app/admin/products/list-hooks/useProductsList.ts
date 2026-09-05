/** ADMIN layer — one page of products, its filters, and the delete flow.
 *
 * The list used to select every active product with every variant embedded,
 * unpaginated, and poll that every 60 seconds. Search, category, status and
 * stock are query parameters now; the browser holds one page.
 */
'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { Product } from '@/types/product';
import type { AdminProductsSummary } from '@/lib/commerce/admin-products-summary';
import { useListParams } from '../../hooks/useListParams';
import { useListData } from '../../hooks/useListData';
import { useListSummary } from '../../hooks/useListSummary';
import { useAdminRealtime } from '../../hooks/useAdminRealtime';

export function useProductsList() {
  const params = useListParams({
    sort: 'created_at',
    direction: 'desc',
    filters: { status: 'active', category: '', stock: 'all' },
  });

  const { items: products, meta, loading, error, refreshSilently } = useListData<Product>(
    '/api/admin/products',
    params.queryString,
    'products'
  );

  // product_variants is the table that actually moves: a confirmed order and
  // a stock edit both write it, and the trigger recomputes products.stock from
  // it. Subscribing to products as well would add a second socket for events
  // this page already learns about.
  const { connected: live } = useAdminRealtime(['product_variants'], refreshSilently);

  const { summary, reloadSummary } = useListSummary<AdminProductsSummary>(
    '/api/admin/products/summary',
    '',
    refreshSilently,
    live
  );

  const reconcile = useCallback(async () => {
    await Promise.all([refreshSilently(), reloadSummary()]);
  }, [refreshSilently, reloadSummary]);

  const [deletingProduct, setDeletingProduct] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const executeDelete = useCallback(
    async (id: string) => {
      setIsDeleting(true);
      try {
        const response = await fetch('/api/admin/products', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });

        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) {
          throw new Error(result?.error || `Request failed (${response.status})`);
        }

        // Refetch rather than reload the window: a full page reload threw away
        // the operator's filters and their place in the list.
        setDeletingProduct(null);
        await reconcile();
        toast.success('Product deleted.');
      } catch (caught: any) {
        console.error('Delete error:', caught);
        toast.error('Error deleting product: ' + caught.message);
        setDeletingProduct(null);
      } finally {
        setIsDeleting(false);
      }
    },
    [reconcile]
  );

  return {
    params,
    products,
    meta,
    summary,
    isLoading: loading,
    error,
    live,
    reconcile,
    deletingProduct,
    setDeletingProduct,
    isDeleting,
    executeDelete,
  };
}
