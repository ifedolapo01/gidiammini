/**
 * ADMIN layer — activating and deactivating a shipping zone, with a way back.
 *
 * Split from useShippingZones for the same reason as the discounts equivalent:
 * the list hook was carrying the form, the modal and the delete flow already.
 */
'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { ShippingZone } from '@/types/shipping';
import { toastWithUndo } from '../../lib/undo-toast';

interface UseShippingZoneStatusArgs {
  refresh: () => void;
  setPendingId: (id: string | null) => void;
}

export function useShippingZoneStatus({ refresh, setPendingId }: UseShippingZoneStatusArgs) {
  /** The write on its own — no success toast, so it is also its own undo. */
  const setActive = useCallback(
    async (zone: ShippingZone, isActive: boolean): Promise<boolean> => {
      setPendingId(zone.id);
      try {
        const res = await fetch('/api/admin/shipping-zones', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...zone, is_active: isActive }),
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
    async (zone: ShippingZone) => {
      const next = !zone.is_active;
      if (!(await setActive(zone, next))) return;

      // Turning a zone off stops checkout quoting delivery to everyone in it —
      // too consequential to happen silently, and cheap enough to reverse.
      toastWithUndo(
        `${zone.name} is now ${next ? 'active' : 'inactive'}.`,
        () => setActive({ ...zone, is_active: next }, !next),
      );
    },
    [setActive],
  );

  return { toggleStatus };
}
