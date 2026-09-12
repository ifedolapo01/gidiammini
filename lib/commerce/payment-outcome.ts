/**
 * COMMERCE layer — the arithmetic of "is this order paid for?".
 *
 * Pure, and deliberately separate from the row-writing in order-payments.ts:
 * the verification screen needs the same answers before anything is written
 * (to suggest an outcome and show the balance), and the server needs them
 * again afterwards to decide whether the order can be confirmed. Two
 * implementations of "is 19,999.99 close enough to 20,000" is exactly the kind
 * of disagreement that leaves an order pending forever.
 */
import type { PaymentStatus } from '@/types/payment';

/**
 * How far apart two money figures may be and still count as equal.
 *
 * Zero. Every figure here is minor units (20260910130000) — an integer — so
 * "expected" and "received" either match exactly or a real minor unit is
 * missing. The float-drift problem this constant used to absorb (order
 * totals computed from unit prices and a shipping fee in floating point,
 * leaving a balance a hundredth of a kobo short) cannot happen once nothing
 * is fractional to begin with.
 */
export const MONEY_EPSILON = 0;

export interface PaymentSettlement {
  /** What the order asked for. */
  expected: number;
  /** Money received so far, across every non-rejected payment. */
  received: number;
  /** Still owed, never negative. 0 once settled. */
  outstanding: number;
  /** Paid in full or better. */
  settled: boolean;
  /** Some money in, but not all of it. */
  partial: boolean;
  /** Received more than asked — worth flagging, never worth failing. */
  overpaid: number;
}

/** Where an order stands, given what it asked for and what has arrived. */
export function settlement(expected: number, received: number): PaymentSettlement {
  const shortfall = expected - received;
  const settled = shortfall <= MONEY_EPSILON;

  return {
    expected,
    received,
    outstanding: settled ? 0 : shortfall,
    settled,
    partial: received > 0 && !settled,
    overpaid: received - expected > MONEY_EPSILON ? received - expected : 0,
  };
}

/**
 * The outcome a verifier most likely means, given the amount they typed.
 *
 * A suggestion, not a decision: the screen preselects it so the common case is
 * one tap, and the verifier can always override — "I know he is sending the
 * rest tonight, mark it short" is a judgement no arithmetic can make.
 */
export function suggestOutcome(
  expected: number,
  alreadyReceived: number,
  amountNow: number
): Extract<PaymentStatus, 'verified' | 'short_paid'> {
  if (!(amountNow > 0)) return 'short_paid';
  return settlement(expected, alreadyReceived + amountNow).settled ? 'verified' : 'short_paid';
}

/**
 * How long this order has been waiting, in whole days.
 *
 * The queue sorts oldest-first and colours anything past a day, because the
 * cost of a slow verification is a customer who thinks their money vanished.
 */
export function daysWaiting(since: string, now: Date = new Date()): number {
  const elapsed = now.getTime() - new Date(since).getTime();
  return Math.max(0, Math.floor(elapsed / 86_400_000));
}
