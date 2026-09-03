/** STOREFRONT layer — checkout stock-validation before moving to payment. */
import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { getVariantStock } from '@/lib/commerce/pricing';
import { PUBLIC_VARIANTS_SELECT } from '@/lib/commerce/product-variants';
import { Product } from '@/types/product';
import { CartItem } from '@/types/order';

/**
 * Re-validates cart item stock against the latest product data before letting
 * the customer proceed to payment. Returns true when every item is in stock;
 * alerts and returns false on the first problem encountered (matches the
 * original inline behavior in app/checkout/page.tsx).
 */
export function useCheckoutStockValidation() {
  const [isValidating, setIsValidating] = useState(false);

  const validateStock = async (items: CartItem[]): Promise<boolean> => {
    setIsValidating(true);
    try {
      const supabase = createClient();
      const productIds = items.map((i: CartItem) => i.productId);

      const { data: products, error } = await supabase
        .from('products')
        // Anon key: the columns are named because `product_variants(*)` would
        // be refused — anon has no grant on cost.
        .select(`id,stock,pricing_config,${PUBLIC_VARIANTS_SELECT}` as const)
        .in('id', productIds);

      if (error) throw error;

      for (const item of items) {
        const product = products?.find(p => p.id === item.productId);
        if (!product) {
          toast.error(`Product ${item.name} is no longer available.`);
          return false;
        }

        const currentStock = getVariantStock(
          { stock: product.stock, pricing_config: product.pricing_config } as Product,
          item.size ?? null,
          item.color ?? null
        );

        if (currentStock < item.quantity) {
          toast.error(`Insufficient stock for ${item.name} ${item.size ? `(${item.size})` : ''} ${item.color ? `(${item.color})` : ''}. Only ${currentStock} available.`);
          return false;
        }
      }

      return true;
    } catch (err) {
      console.error('Error validating stock:', err);
      toast.error('Failed to validate stock. Please try again.');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  return { validateStock, isValidating };
}
