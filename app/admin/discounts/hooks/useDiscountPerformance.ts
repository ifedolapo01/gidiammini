/** ADMIN layer — what each discount earned.
 *
 * A second request after the discounts land, not part of them: the list has to
 * render the moment it can, and this reads every discounted order line in the
 * shop. Nothing on the page waits for it.
 */
'use client';

import { useEffect, useState } from 'react';
import type { DiscountPerformance } from '@/lib/commerce/discount-performance';

export function useDiscountPerformance() {
  const [performance, setPerformance] = useState<Record<string, DiscountPerformance>>({});
  /** True when the figures could not be read at all — usually a deployment
   *  that has not applied 20260906150000. The column shows a dash rather than
   *  a row of confident zeroes. */
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await fetch('/api/admin/discounts/performance');
        const data = await response.json().catch(() => null);
        if (!active) return;

        if (!response.ok || !data?.success) throw new Error('Failed to load');

        setPerformance(data.performance ?? {});
        setUnavailable(Boolean(data.unavailable));
      } catch (error) {
        // Not toasted. The discounts themselves are unaffected, and an error
        // banner over a reporting column is noise about something nobody was
        // waiting for.
        console.error('Error loading discount performance:', error);
        if (active) setUnavailable(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return { performance, unavailable };
}
