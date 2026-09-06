/**
 * COMMERCE layer (server only) — resolving a redemption code during pricing.
 *
 * Split from price-order.ts so that file stays readable as the one place every
 * naira is decided. This is the part that needs the database for a reason
 * nothing else in pricing does: the per-customer limit is a count of past
 * redemptions by email, which cannot be derived from the catalogue.
 *
 * HOW A CODE COMPETES RATHER THAN STACKS
 *
 * A valid PERCENTAGE or FIXED code is added to the candidate list that
 * getBestDiscount() already picks from, so each line takes whichever discount
 * saves the customer most — the code, or a sale that was already running. It
 * never stacks on top.
 *
 * That is the honest behaviour and it is also the safe one. Stacking is a
 * policy nobody has stated, and a 20% sale plus a 20% code silently becoming
 * 36% off is the kind of thing a shop discovers in its margins a fortnight
 * later. The consequence — a code that saves nothing because the sale was
 * better — is reported back so the checkout can say so rather than leaving the
 * customer to wonder whether the code worked.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Discount } from './discounts';
import { checkDiscountCode, normaliseCode, type CodeCheckResult } from './discount-code';

export interface ResolvedCode {
  /** The discount to add to the line-pricing candidates. Null when the code
   *  was absent, unrecognised or refused — pricing carries on without it. */
  discount: Discount | null;
  /** The code as it will be recorded, uppercase. */
  code: string | null;
  /** Why a supplied code was not applied, in the customer's words. Null when
   *  no code was supplied or it was accepted. */
  error: string | null;
}

const NONE: ResolvedCode = { discount: null, code: null, error: null };

/**
 * How many times this email has already redeemed this discount.
 *
 * Matched on email rather than customer_id: a guest checkout has no customer
 * row until the order lands, and a code limited to one use per person has to
 * hold for people who have never signed in. Lower-cased at both ends.
 */
async function timesUsedBy(
  supabase: SupabaseClient,
  discountId: string,
  email: string | null
): Promise<number> {
  if (!email) return 0;

  const { count, error } = await supabase
    .from('discount_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('discount_id', discountId)
    .eq('email', email.trim().toLowerCase());

  if (error) {
    // Fail closed on the limit: an unreadable redemption history must not turn
    // a one-per-customer code into an unlimited one. The customer is told the
    // code could not be applied, which is recoverable; a code redeemed a
    // thousand times is not.
    console.error('Could not read redemption history:', error);
    return Number.MAX_SAFE_INTEGER;
  }

  return count ?? 0;
}

/**
 * Looks a code up among the discounts already fetched for this quote, and
 * decides whether it may be used.
 *
 * Takes the active discount list rather than querying again: priceOrder has
 * already read every active discount to price the lines, and a second round
 * trip for a row that is certainly in that array would be one more thing that
 * can disagree with itself.
 */
export async function resolveDiscountCode(
  supabase: SupabaseClient,
  params: {
    rawCode: unknown;
    activeDiscounts: Discount[];
    /** Items subtotal after automatic discounts — what a minimum is judged on. */
    subtotal: number;
    customerEmail: string | null;
  }
): Promise<ResolvedCode> {
  const code = normaliseCode(params.rawCode);

  // Nothing typed, or something that could not be a code at all. The second
  // case is deliberately silent rather than an error: a customer who tabbed
  // through an empty field and left a stray space has not made a mistake worth
  // a red message.
  if (!code) {
    const typedSomething = typeof params.rawCode === 'string' && params.rawCode.trim() !== '';
    return typedSomething
      ? { ...NONE, error: "We don't recognise that code. Check the spelling and try again." }
      : NONE;
  }

  const match = params.activeDiscounts.find(
    (discount) => (discount.code ?? '').toUpperCase() === code
  );

  const timesUsed = match
    ? await timesUsedBy(supabase, match.id, params.customerEmail)
    : 0;

  const verdict: CodeCheckResult = checkDiscountCode({
    discount: match ?? null,
    subtotal: params.subtotal,
    timesUsedByCustomer: timesUsed,
  });

  if (!verdict.ok) {
    return { discount: null, code, error: verdict.message };
  }

  return { discount: verdict.discount, code, error: null };
}
