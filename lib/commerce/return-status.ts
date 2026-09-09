/** COMMERCE layer — the return lifecycle: the canonical order, display
 * formatting, badge color, and which transitions are valid from where.
 * Shared by the admin Returns panel (which button to show) and the API route
 * (the server-side guard against skipping a step) — see return-lifecycle.ts. */
import { formatOrderStatus } from './order-status';
import type { ReturnStatus } from '@/types/return';

export const RETURN_STATUSES: ReturnStatus[] = [
  'requested',
  'approved',
  'received',
  'inspected',
  'restocked',
  'rejected',
  'refunded',
];

/** Reuses the same "snake_case -> Title Case" formatter order statuses use —
 *  there is nothing return-specific about turning a string into a label. */
export const formatReturnStatus = formatOrderStatus;

/** Matches components/ui/Badge's BadgeTone exactly, so this can be passed
 *  straight to a Badge's `tone` prop without a separate class-name mapping. */
export type ReturnStatusColorToken = 'warning' | 'info' | 'primary' | 'success' | 'destructive';

export function getReturnStatusColorToken(status: ReturnStatus): ReturnStatusColorToken {
  switch (status) {
    case 'requested':
      return 'warning';
    case 'approved':
    case 'received':
      return 'info';
    case 'inspected':
      return 'primary';
    case 'restocked':
    case 'refunded':
      return 'success';
    case 'rejected':
      return 'destructive';
  }
}

/** Tailwind classes for a status, where a consumer needs raw classes rather
 *  than a Badge's `tone` prop (e.g. the storefront timeline banner, which
 *  isn't built from Badge). Mirrors order-status.ts's own
 *  getStatusColor/getStatusColorToken split for the same reason. */
export function getReturnStatusColor(status: ReturnStatus): string {
  switch (getReturnStatusColorToken(status)) {
    case 'warning':
      return 'bg-warning-background text-warning';
    case 'info':
      return 'bg-info-background text-info';
    case 'primary':
      return 'bg-secondary text-primary';
    case 'success':
      return 'bg-success-background text-success';
    case 'destructive':
      return 'bg-destructive-background text-destructive';
  }
}

/** Every status a return can move to FROM its current one. 'restocked' has no
 *  listed next step: it advances to 'refunded' only when the refund recorded
 *  alongside it is settled (see refund-settlement.ts), never by a direct
 *  admin transition — the whole point of this lifecycle is that money moves
 *  at a deliberate, separate step. 'rejected' and 'refunded' are terminal. */
export const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ['approved', 'rejected'],
  approved: ['received'],
  received: ['inspected'],
  inspected: ['restocked', 'rejected'],
  restocked: [],
  rejected: [],
  refunded: [],
};

export function canTransitionReturn(current: ReturnStatus, next: ReturnStatus): boolean {
  return RETURN_TRANSITIONS[current].includes(next);
}
