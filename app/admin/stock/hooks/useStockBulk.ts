/** ADMIN layer — setting the same stock figure on every selected variant.
 *
 * A stock count is the case this exists for: the operator has just counted a
 * shelf and needs twelve variants set to the same number. It goes through the
 * batch endpoint, which calls the same set_variant_stock() the single-variant
 * save does — so the row lock, the products.stock recomputation and the
 * back-in-stock alerts all behave identically.
 */
'use client';

import { useCallback } from 'react';
import { useBulkAction } from '../../hooks/useBulkAction';
import { postBulkBatched } from '../../lib/bulkRequest';

export function useStockBulk(onApplied: () => void | Promise<void>) {
  const bulk = useBulkAction(() => void onApplied());
  const { schedule } = bulk;

  const setStock = useCallback(
    (ids: string[], stock: number) => {
      if (ids.length === 0) return;

      schedule({
        description: `Set stock to ${stock}`,
        count: ids.length,
        run: () => postBulkBatched('/api/admin/products/bulk', ids, { action: 'stock_set', stock }),
      });
    },
    [schedule]
  );

  return { ...bulk, setStock };
}
