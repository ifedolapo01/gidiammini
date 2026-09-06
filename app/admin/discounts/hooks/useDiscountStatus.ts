/**
 * ADMIN layer — activating and pausing a discount, with a way back.
 *
 * Split from useDiscounts, which was carrying the list, the form, the modal,
 * the delete flow and this. The two halves of the status change belong
 * together and nowhere else: the write, and the confirmation that offers its
 * own inverse.
 */
'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Discount } from '@/lib/commerce/discounts';
import { toastWithUndo } from '../../lib/undo-toast';

interface UseDiscountStatusArgs {
  /** Refetches the list after a successful write. */
  refresh: () => void;
  /** Shared with the table so one row at a time shows as busy. */
  setPendingId: (id: string | null) => void;
}

export function useDiscountStatus({ refresh, setPendingId }: UseDiscountStatusArgs) {
  /** The write on its own. Returns whether it landed, and raises no success
   *  toast — which is what lets it serve as both the action and its undo. */
  const setActive = useCallback(
    async (discount: Discount, isActive: boolean): Promise<boolean> => {
      setPendingId(discount.id);
      try {
        const res = await fetch('/api/admin/discounts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...discount, is_active: isActive }),
        });
        const data = await res.json();
        if (data.success) {
          refresh();
          return true;
        }
        toast.error(data.error || 'Failed to change status');
        return false;
      } catch {
        toast.error('Failed to change status');
        return false;
      } finally {
        setPendingId(null);
      }
    },
    [refresh, setPendingId],
  );

  const toggleStatus = useCallback(
    async (discount: Discount) => {
      const next = !discount.is_active;
      if (!(await setActive(discount, next))) return;

      // Previously silent on success: the row's toggle moved and nothing else
      // did, so pausing the wrong discount looked identical to pausing the
      // right one. This says which one moved, and offers the way back.
      toastWithUndo(
        `${discount.name} is now ${next ? 'active' : 'paused'}.`,
        () => setActive({ ...discount, is_active: next }, !next),
      );
    },
    [setActive],
  );

  return { toggleStatus };
}
