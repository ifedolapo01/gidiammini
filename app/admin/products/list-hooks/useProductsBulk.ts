/** ADMIN layer — the bulk actions on the products list.
 *
 * All four go through the one batch endpoint, behind the shared undo window,
 * and come back with a per-row result. The descriptions are the operator's
 * words rather than the action names, because they are what the undo bar and
 * the result summary display.
 */
'use client';

import { useCallback } from 'react';
import { describePercent } from '@/lib/commerce/price-adjust';
import { useBulkAction } from '../../hooks/useBulkAction';
import { postBulkBatched } from '../../lib/bulkRequest';

const ENDPOINT = '/api/admin/products/bulk';

export function useProductsBulk(onApplied: () => void | Promise<void>) {
  const bulk = useBulkAction(() => void onApplied());
  const { schedule } = bulk;

  const setActive = useCallback(
    (ids: string[], isActive: boolean) => {
      schedule({
        description: isActive ? 'Activate products' : 'Deactivate products',
        count: ids.length,
        run: () => postBulkBatched(ENDPOINT, ids, { action: isActive ? 'activate' : 'deactivate' }),
      });
    },
    [schedule]
  );

  const moveCategory = useCallback(
    (ids: string[], category: string, subCategory: string | null) => {
      schedule({
        description: `Move to ${category}${subCategory ? ` / ${subCategory}` : ''}`,
        count: ids.length,
        run: () => postBulkBatched(ENDPOINT, ids, { action: 'category', category, subCategory }),
      });
    },
    [schedule]
  );

  const adjustPrice = useCallback(
    (ids: string[], percent: number) => {
      schedule({
        description: `Price ${describePercent(percent)}`,
        count: ids.length,
        run: () => postBulkBatched(ENDPOINT, ids, { action: 'price_adjust', percent }),
      });
    },
    [schedule]
  );

  return { ...bulk, setActive, moveCategory, adjustPrice };
}
