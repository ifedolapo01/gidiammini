/** ADMIN layer — stock data loading + derived summary counts for the stock management page. */
import { useState, useEffect } from 'react';
import { flattenProducts, FlattenedProduct } from '@/lib/commerce/product-flatten';
import { ADMIN_POLL_INTERVAL_MS } from '../../lib/adminPolling';

export function useStock() {
  const [products, setProducts] = useState<FlattenedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);

  useEffect(() => {
    loadStock();
  }, []);

  const loadStock = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/products/stock');
      if (response.ok) {
        const data = await response.json();
        setProducts(flattenProducts(data.products || []));
      }
    } catch (error) {
      console.error('Error loading stock:', error);
    } finally {
      setLoading(false);
    }
  };

  /** Reconciles with the server without toggling `loading` — used after
   * saving a stock change, and on a background poll, so the table stays
   * accurate without flashing the full-page loading state. */
  const loadStockSilently = async () => {
    try {
      const response = await fetch('/api/admin/products/stock');
      if (response.ok) {
        const data = await response.json();
        setProducts(flattenProducts(data.products || []));
      }
    } catch (error) {
      console.error('Error syncing stock:', error);
    }
  };

  useEffect(() => {
    const interval = setInterval(loadStockSilently, ADMIN_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= lowStockThreshold);
  const outOfStockProducts = products.filter(p => p.stock <= 0);
  const mainProductsCount = new Set(products.map(p => p.productId)).size;

  return {
    products,
    loading,
    loadStock,
    loadStockSilently,
    lowStockThreshold,
    setLowStockThreshold,
    lowStockProducts,
    outOfStockProducts,
    mainProductsCount,
  };
}
