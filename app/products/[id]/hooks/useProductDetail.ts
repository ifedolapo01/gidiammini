/** STOREFRONT layer — fetches a single product plus active discounts. */
import { useState, useEffect } from 'react';
import { getProduct } from '@/lib/supabase/actions';
import { createClient } from '@/lib/supabase/client';
import { Product } from '@/types/product';
import { Discount } from '@/lib/commerce/discounts';

export function useProductDetail(productId: string | undefined) {
  const [product, setProduct] = useState<Product | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const loadProduct = async () => {
    if (!productId) return;

    setLoading(true);
    try {
      const data = await getProduct(productId);
      setProduct(data);

      // Fetch active discounts
      const supabase = createClient();
      const { data: discountsData } = await supabase
        .from('discounts')
        .select('*')
        .eq('is_active', true);

      if (discountsData) {
        setDiscounts(discountsData as Discount[]);
      }
    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  };

  return { product, discounts, loading };
}
