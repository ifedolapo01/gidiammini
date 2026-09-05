// types/payment.ts — the shape of a payment-verification decision.
//
// One row per decision, written by lib/commerce/order-payments.ts and never
// updated in place: a correction is a new row. See migration
// 20260905180000_order_payments.sql for why a rejection is stored here at all.

import type { PaymentRejectionCode } from '@/lib/commerce/payment-rejection';

/**
 * What the verifier decided.
 *
 *   verified   — the expected amount arrived (or more).
 *   short_paid — money arrived, but less than the order asked for.
 *   rejected   — nothing is being credited; reason_code says why.
 */
export type PaymentStatus = 'verified' | 'short_paid' | 'rejected';

/** How the money arrived. */
export type PaymentMethod = 'transfer' | 'paystack' | 'cash' | 'pos';

export interface OrderPayment {
  id: string;
  order_id: string;
  status: PaymentStatus;
  /** Naira actually seen. 0 on a rejection. */
  amount: number;
  method: PaymentMethod;
  /** The bank's reference off the receipt, for reconciliation. */
  reference: string | null;
  /** When the money moved, per the receipt — not when it was verified. */
  received_at: string;
  reason_code: PaymentRejectionCode | null;
  /** The verifier's own words. Internal. */
  note: string | null;
  /** The receipt image this decision was made against. */
  receipt_path: string | null;
  actor_id: string | null;
  actor_email: string | null;
  created_at: string;
}

/** What the verification screen submits. */
export interface RecordPaymentInput {
  orderId: string;
  status: PaymentStatus;
  /** Ignored for a rejection, required otherwise. */
  amount?: number;
  method?: PaymentMethod;
  reference?: string | null;
  /** ISO instant. Defaults to now when the verifier does not change it. */
  receivedAt?: string | null;
  reasonCode?: PaymentRejectionCode | null;
  note?: string | null;
  /** Whether to email the customer about this outcome. Default true. */
  notify?: boolean;
}

/** One order waiting for its money to be confirmed. */
export interface PaymentQueueItem {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_amount: number;
  amount_paid: number;
  status: string;
  payment_method: 'transfer' | 'paystack';
  payment_verified: boolean;
  receipt_path: string | null;
  note: string | null;
  created_at: string;
  /** Every decision already recorded against this order, newest first. */
  payments: OrderPayment[];
}
