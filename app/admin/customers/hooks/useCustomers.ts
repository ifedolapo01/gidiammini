/** ADMIN layer — the customer list: query state, one page of buyers, and the
 * tags in use.
 *
 * Built entirely out of the shared list hooks, so the paging, the debounced
 * search and the stale-response guard are the same implementation every other
 * admin table uses rather than a fourth copy of them.
 *
 * The tag facet rides along on the same response (see useListData's extraKey)
 * rather than being fetched separately: a filter control listing tags from one
 * request while the rows came from another is a control that can offer a tag
 * nothing on screen carries.
 */
'use client';

import type { CustomerSummary } from '@/types/customer';
import { useListParams } from '../../hooks/useListParams';
import { useListData } from '../../hooks/useListData';

export function useCustomers() {
  const params = useListParams({
    // Best customers first. The list exists to answer "who matters here", and
    // alphabetical would answer nothing.
    sort: 'lifetime_value',
    direction: 'desc',
    filters: { tag: '', blocked: '' },
  });

  const { items, meta, extra, loading, error, refreshSilently } = useListData<
    CustomerSummary,
    string[]
  >('/api/admin/customers', params.queryString, 'customers', 'tags');

  return {
    params,
    customers: items,
    meta,
    tags: extra ?? [],
    loading,
    error,
    refresh: refreshSilently,
  };
}
