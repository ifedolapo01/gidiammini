/** ADMIN layer — one buyer: their stats, their orders, the addresses they have
 * used, what they are still saving, and the three fields an admin may change.
 *
 * One fetch for the whole screen rather than one per panel. The route already
 * runs the four reads in parallel server-side, and four browser round trips
 * would render the page in four stages for no benefit.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  CustomerAddress,
  CustomerDetail,
  CustomerOrder,
  CustomerWishlistEntry,
} from '@/types/customer';

type ShowToast = (message: string, type?: 'success' | 'error') => void;

export interface CustomerEdits {
  is_blocked: boolean;
  blocked_reason: string;
  notes: string;
  tags: string[];
}

export function useCustomerDetail(id: string, showToast: ShowToast) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [wishlist, setWishlist] = useState<CustomerWishlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/customers/${id}`);
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        setError(result?.error || 'Could not load this customer.');
        return;
      }

      setCustomer(result.customer);
      setOrders(result.orders ?? []);
      setAddresses(result.addresses ?? []);
      setWishlist(result.wishlist ?? []);
      setError('');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (edits: CustomerEdits): Promise<boolean> => {
      setSaving(true);
      try {
        const response = await fetch(`/api/admin/customers/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(edits),
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          showToast(result?.error || 'Could not save those changes.', 'error');
          return false;
        }

        // Re-read rather than merging the response in: the tags come back
        // normalised by a database trigger, and echoing what was typed would
        // show "Wholesale" where "wholesale" was stored.
        await load();
        showToast('Customer updated.', 'success');
        return true;
      } catch {
        showToast('Could not reach the server. Nothing was changed.', 'error');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [id, showToast, load]
  );

  return { customer, orders, addresses, wishlist, loading, error, saving, save, reload: load };
}
