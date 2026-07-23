/** ADMIN layer — data loading + delete flow for the products list page. */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { Product } from '@/types/product';
import { ADMIN_POLL_INTERVAL_MS } from '../../lib/adminPolling';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingProduct, setDeletingProduct] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) {
      setIsLoading(true);
      setError('');
    }

    try {
      const response = await fetch('/api/admin/products', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load products');
      }

      setProducts(result.products || []);
    } catch (error: any) {
      console.error('Error fetching products:', error);
      if (!opts.silent) setError(error.message || 'Failed to load products. Please check your connection.');
    } finally {
      if (!opts.silent) setIsLoading(false);
    }
  };

  // Background poll — keeps the list fresh without a manual Refresh button.
  useEffect(() => {
    const interval = setInterval(() => fetchProducts({ silent: true }), ADMIN_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const executeDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch('/api/admin/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete product');
      }

      window.location.reload();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error('Error deleting product: ' + error.message);
      setIsDeleting(false);
      setDeletingProduct(null);
    }
  };

  return {
    products,
    isLoading,
    error,
    deletingProduct,
    setDeletingProduct,
    isDeleting,
    executeDelete,
  };
}
