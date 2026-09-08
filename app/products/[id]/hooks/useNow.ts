/** STOREFRONT layer — a clock that re-renders its component on an interval.
 *
 * Pulled out of ProductDetailsAccordion when a second component (the delivery
 * promise under Add to Cart) needed the same minute-by-minute refresh for its
 * own cutoff countdown — two independent `setInterval`s ticking the same
 * product page is wasted renders for no benefit either one can see.
 */
import { useEffect, useState } from 'react';

export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
