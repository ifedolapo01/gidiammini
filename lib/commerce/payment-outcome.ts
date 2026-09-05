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
 * How far apart two naira figures may be and still count as equal.
 *
 * Half a naira. Order totals are computed from unit prices and a shipping fee
 * in floating point, so an exact `>=` comparison can leave an order one
 * hundredth of a kobo short of settled — a balance no customer can pay and no
 * verifier can explain. Nothing anybody in this shop transacts is smaller than
 * this, so no real shortfall is hidden by it.
 */
export const MONEY_EPSILON = 0.5;

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
    outstanding: settled ? 0 : round2(shortfall),
    settled,
    partial: received > 0 && !settled,
    overpaid: received - expected > MONEY_EPSILON ? round2(received - expected) : 0,
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

/** Naira, to the kobo. Keeps a displayed balance from reading 1999.9999999. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
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
