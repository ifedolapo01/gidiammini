/** COMMERCE layer — reads live stock for a cart, for any screen that needs it. */
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PUBLIC_VARIANTS_SELECT } from '@/lib/commerce/product-variants';
import { cartStockSnapshot, type CartStockProduct } from '@/lib/commerce/cart-stock';
import type { CartItem } from '@/types/order';

/**
 * Fetches stock on hand for the given cart lines. Shared by the cart page,
 * which flags problems on mount, and the checkout gate, which refuses to
 * advance — so both read the same columns through the same code and cannot
 * disagree about whether a line is sellable.
 *
 * Reporting the failure is left to the caller: the checkout gate must tell the
 * customer it could not check, while the cart page stays quiet and simply
 * flags nothing.
 */
export function useCartStockCheck() {
  const [isChecking, setIsChecking] = useState(false);

  /** Stock per cart line (see cartStockSnapshot), or null if the read failed. */
  const fetchStock = async (items: CartItem[]): Promise<Map<string, number> | null> => {
    if (items.length === 0) return new Map();

    setIsChecking(true);
    try {
      const supabase = createClient();
      const productIds = [...new Set(items.map((item) => item.productId))];

      const { data, error } = await supabase
        .from('products')
        // Anon key: the columns are named because `product_variants(*)` would
        // be refused — anon has no grant on cost.
        .select(`id,stock,pricing_config,${PUBLIC_VARIANTS_SELECT}` as const)
        .in('id', productIds);

      if (error) throw error;

      return cartStockSnapshot(items, (data ?? []) as CartStockProduct[]);
    } catch (err) {
      console.error('Error reading cart stock:', err);
      return null;
    } finally {
      setIsChecking(false);
    }
  };

  return { fetchStock, isChecking };
}
