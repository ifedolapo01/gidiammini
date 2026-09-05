/** ADMIN layer — everything the products list page needs, composed.
 *
 * Split into a data hook and a bulk hook so neither grows into the file this
 * used to be: a fetch, a 60-second whole-catalogue poll and a delete flow in
 * one place.
 */
'use client';

import { useProductsList } from './useProductsList';
import { useProductsBulk } from './useProductsBulk';

export function useProducts() {
  const list = useProductsList();
  const bulk = useProductsBulk(list.reconcile);

  return { ...list, bulk };
}
