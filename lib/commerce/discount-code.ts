/**
 * COMMERCE layer — whether a code may be used, and what it is worth. Pure.
 *
 * Split from discounts.ts, which decides which discount best prices a *line*.
 * This decides whether a code is admissible for an *order*, which is a
 * different question with different inputs: the basket total, who is buying,
 * and how many times the code has already been used.
 *
 * Every reason is its own case with its own sentence. "That code is not valid"
 * for a code that has expired, one that needs a bigger basket, and one that
 * has run out is three different conversations with support, and the customer
 * can act on two of them.
 *
 * NOTHING HERE IS THE AUTHORITY ON ITS OWN
 *
 * The redemption ceiling is checked here against a count read a moment
 * earlier, so two simultaneous checkouts can both pass it. The thing that
 * actually holds is the UNIQUE (discount_id, order_id) on
 * discount_redemptions plus the counter trigger — this is the check that gives
 * a customer a sentence instead of a constraint violation.
 */
import type { Discount } from './discounts';
import { calculateSavings, requiresCode } from './discounts';

export type CodeRejection =
  | 'unknown'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'below_minimum'
  | 'exhausted'
  | 'already_used';

export interface CodeCheckInput {
  discount: Discount | null;
  /** Items subtotal, after any automatic discounts. */
  subtotal: number;
  /** How many times this email has already redeemed this code. */
  timesUsedByCustomer: number;
  now?: Date;
}

export type CodeCheckResult =
  | { ok: true; discount: Discount }
  | { ok: false; reason: CodeRejection; message: string };

/** The naira figure in a rejection message, so a customer knows what to do. */
function naira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString()}`;
}

export function checkDiscountCode(input: CodeCheckInput): CodeCheckResult {
  const { discount, subtotal, timesUsedByCustomer, now = new Date() } = input;

  const reject = (reason: CodeRejection, message: string): CodeCheckResult => ({
    ok: false,
    reason,
    message,
  });

  if (!discount) {
    return reject('unknown', "We don't recognise that code. Check the spelling and try again.");
  }

  // A code on a discount that was switched off reads to the customer exactly
  // like a code that never existed, and saying so avoids confirming which
  // codes are real to somebody guessing.
  if (!discount.is_active) {
    return reject('inactive', "We don't recognise that code. Check the spelling and try again.");
  }

  if (!requiresCode(discount)) {
    // Somebody typed the name of an automatic discount. It is already applied.
    return reject('unknown', "That discount doesn't need a code — it's already applied.");
  }

  if (discount.start_date && new Date(discount.start_date) > now) {
    return reject('not_started', 'That code is not active yet.');
  }

  if (discount.end_date && new Date(discount.end_date) < now) {
    return reject('expired', 'That code has expired.');
  }

  const minimum = discount.min_order_value ?? 0;
  if (minimum > 0 && subtotal < minimum) {
    return reject(
      'below_minimum',
      `That code needs a basket of ${naira(minimum)} or more. You're ${naira(minimum - subtotal)} away.`
    );
  }

  const cap = discount.max_redemptions;
  if (typeof cap === 'number' && (discount.redemption_count ?? 0) >= cap) {
    return reject('exhausted', 'That code has been fully claimed.');
  }

  const perCustomer = discount.per_customer_limit;
  if (typeof perCustomer === 'number' && timesUsedByCustomer >= perCustomer) {
    return reject(
      'already_used',
      perCustomer === 1
        ? "You've already used that code."
        : `You've already used that code ${perCustomer} times.`
    );
  }

  return { ok: true, discount };
}

/** Codes are stored and compared uppercase, because a customer typing
 *  "welcome10" has entered WELCOME10 and being told otherwise is the shop's
 *  fault. Returns null for anything that is not a code at all. */
export function normaliseCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code) ? code : null;
}

/**
 * What a code discount takes off, given the lines it is allowed to touch.
 *
 * FREE_SHIPPING is answered by the caller, not here: only priceOrder knows
 * what the resolved zone charges. Everything else is the same per-line
 * arithmetic the automatic discounts use, so a code and an automatic discount
 * of the same shape can never produce different numbers.
 */
export function codeSavingsOnLines(
  discount: Discount,
  lines: { price: number; quantity: number; eligible: boolean }[]
): number {
  if (discount.type === 'FREE_SHIPPING') return 0;

  return lines.reduce((total, line) => {
    if (!line.eligible) return total;
    return total + Math.round(calculateSavings(line.price, discount)) * line.quantity;
  }, 0);
}
