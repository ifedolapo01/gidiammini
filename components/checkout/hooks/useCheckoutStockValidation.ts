/** STOREFRONT layer — checkout stock-validation before moving to payment. */
import { createClient } from '@/lib/supabase/client';
import { getVariantStock } from '@/lib/commerce/pricing';
import { Product } from '@/types/product';
import { CartItem } from '@/types/order';

/**
 * Re-validates cart item stock against the latest product data before letting
 * the customer proceed to payment. Returns true when every item is in stock;
 * alerts and returns false on the first problem encountered (matches the
 * original inline behavior in app/checkout/page.tsx).
 */
export function useCheckoutStockValidation() {
  const validateStock = async (items: CartItem[]): Promise<boolean> => {
    try {
      const supabase = createClient();
      const productIds = items.map((i: CartItem) => i.productId);

      const { data: products, error } = await supabase
        .from('products')
        .select('id, stock, pricing_config')
        .in('id', productIds);

      if (error) throw error;

      for (const item of items) {
        const product = products?.find(p => p.id === item.productId);
        if (!product) {
          alert(`Product ${item.name} is no longer available.`);
          return false;
        }

        const currentStock = getVariantStock(
          { stock: product.stock, pricing_config: product.pricing_config } as Product,
          item.size ?? null,
          item.color ?? null
        );

        if (currentStock < item.quantity) {
          alert(`Insufficient stock for ${item.name} ${item.size ? `(${item.size})` : ''} ${item.color ? `(${item.color})` : ''}. Only ${currentStock} available.`);
          return false;
        }
      }

      return true;
    } catch (err) {
      console.error('Error validating stock:', err);
      alert('Failed to validate stock. Please try again.');
      return false;
    }
  };

  return { validateStock };
}
