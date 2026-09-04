/** STOREFRONT layer — checkout stock-validation before moving to payment. */
'use client';

import { toast } from 'sonner';
import { useCartStockCheck } from '@/components/commerce/hooks/useCartStockCheck';
import { findCartStockIssues, describeStockShortage } from '@/lib/commerce/cart-stock';
import { CartItem } from '@/types/order';

/**
 * Re-validates cart item stock against the latest catalogue data before letting
 * the customer proceed to payment. Returns true when every item is in stock;
 * reports and returns false on the first problem encountered.
 */
export function useCheckoutStockValidation() {
  const { fetchStock, isChecking } = useCartStockCheck();

  const validateStock = async (items: CartItem[]): Promise<boolean> => {
    const snapshot = await fetchStock(items);

    if (!snapshot) {
      toast.error('Failed to validate stock. Please try again.');
      return false;
    }

    const [issue] = findCartStockIssues(items, snapshot);
    if (issue) {
      toast.error(describeStockShortage(issue));
      return false;
    }

    return true;
  };

  return { validateStock, isValidating: isChecking };
}
