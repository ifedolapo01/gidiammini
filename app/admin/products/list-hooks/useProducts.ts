/** ADMIN layer — data loading + delete flow for the products list page. */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { Product } from '@/types/product';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingProduct, setDeletingProduct] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    setError('');

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
      setError(error.message || 'Failed to load products. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

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
