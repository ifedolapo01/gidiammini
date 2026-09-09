// types/return.ts

/** requested -> approved -> received -> inspected -> restocked | rejected.
 *  restocked advances to refunded through the existing refund settle flow —
 *  see lib/commerce/refund-settlement.ts — not a status an admin sets directly. */
export type ReturnStatus =
  | 'requested'
  | 'approved'
  | 'received'
  | 'inspected'
  | 'restocked'
  | 'rejected'
  | 'refunded';

export interface ReturnItem {
  id: string;
  return_id: string;
  order_item_id: string;
  quantity: number;
  restocked: boolean;
}

export interface Return {
  id: string;
  rma_number: string;
  order_id: string;
  status: ReturnStatus;
  reason: string;
  admin_response: string | null;
  refund_id: string | null;
  requested_at: string;
  approved_at: string | null;
  received_at: string | null;
  inspected_at: string | null;
  restocked_at: string | null;
  rejected_at: string | null;
  refunded_at: string | null;
  created_at: string;
  return_items?: ReturnItem[];
}

/** What the storefront submission form sends. */
export interface CreateReturnInput {
  orderNumber: string;
  contact: string;
  reason: string;
  items: Array<{ orderItemId: string; quantity: number }>;
}

/** The narrow shape the public track-order lookup attaches to an order — see
 *  app/api/orders/track/route.ts. Never the admin actor or the full item list. */
export interface ActiveReturnSummary {
  id: string;
  rma_number: string;
  status: ReturnStatus;
  requested_at: string;
}
