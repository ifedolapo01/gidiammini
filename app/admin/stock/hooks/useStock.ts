/** ADMIN layer — stock data loading + derived summary counts for the stock management page. */
import { useState, useEffect } from 'react';
import { flattenProducts, FlattenedProduct } from '@/lib/commerce/product-flatten';

export function useStock() {
  const [products, setProducts] = useState<FlattenedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      setRefreshing(false);
    }
  };

  const refreshStock = () => {
    setRefreshing(true);
    loadStock();
  };

  const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= lowStockThreshold);
  const outOfStockProducts = products.filter(p => p.stock <= 0);
  const mainProductsCount = new Set(products.map(p => p.productId)).size;

  return {
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
  };
}
