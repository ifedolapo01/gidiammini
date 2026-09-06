/**
 * ADMIN layer — order status to Badge tone.
 *
 * order-status.ts already maps a status to a semantic colour token for the
 * status chips; Badge names its tones slightly differently, and 'accent' has
 * no Badge equivalent. This is the one place that translation happens, rather
 * than a switch inside whichever component needed it.
 */
import { getStatusColorToken } from '@/lib/commerce/order-status';
import type { OrderStatus } from '@/types/order';
import type { BadgeTone } from '@/components/ui';

export function statusTone(status: OrderStatus): BadgeTone {
  const token = getStatusColorToken(status);
  // Badge has no 'accent' tone; 'info' is the nearest in weight and meaning
  // (a stage in progress rather than a success or a problem).
  return token === 'accent' ? 'info' : token;
}
