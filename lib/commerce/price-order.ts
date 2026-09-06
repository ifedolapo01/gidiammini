/**
 * COMMERCE layer — the single pricing authority for a checkout cart.
 *
 * Every naira a customer is charged is computed here, on the server, from the
 * catalogue: variant price from pricing_config, the best currently-valid
 * discount, tax, and the delivery fee of the shipping zone their address
 * actually resolves to. The client sends only *what* is being bought
 * (product/size/color/quantity, parsed by cart-input.ts) and where it is
 * going — never a price, never a total. Anything price-shaped arriving from a
 * browser is a display value to be verified, never an input.
 *
 * Deliberately built on the same pure helpers the storefront renders with
 * (getVariantPrice, getBestDiscount, calculateTax, resolveEffectiveZone), so
 * the number shown on the product page and the number charged can only ever
 * disagree because the catalogue changed mid-session — which is exactly the
 * case callers are expected to surface to the customer.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { describeStockShortage } from './cart-stock';
import { automaticLineDiscounts, findFreeShippingDiscount, type Discount } from './discounts';
import { resolveDiscountCode } from './price-order-code';
import { priceCartLines, sumOf } from './price-lines';
import { loadPricingContext } from './price-order-context';
import { calculateTax } from './checkout';
import { applyFreeShipping } from './store-settings';
import type { PricedLine, PriceOrderInput, PriceOrderResult } from './price-order.types';

export type {
  AppliedCode,
  PricedLine,
  PricedOrder,
  PriceOrderInput,
  PriceOrderResult,
} from './price-order.types';

function fail(error: string, status = 400): { ok: false; error: string; status: number } {
  return { ok: false, error, status };
}

/**
 * The first priced line short of its requested quantity, described for the
 * customer — or null when everything is available. Pure, so the quote endpoint
 * and the order-creation endpoint reject identically.
 */
export function findStockShortage(priced: PricedLine[]): string | null {
  for (const line of priced) {
    if (line.available_stock < line.quantity) {
      // Same sentence the cart page and the checkout gate use, from
      // cart-stock.ts, so a shopper is not told two different things about
      // one line depending on which screen noticed.
      return describeStockShortage({
        name: line.product_name,
        size: line.size,
        color: line.color,
        available: line.available_stock,
      });
    }
  }

  return null;
}

/**
 * Prices a cart against the live catalogue. Returns the fetched products
 * alongside the priced order so callers don't have to re-query them.
 */
export async function priceOrder(
  supabase: SupabaseClient,
  input: PriceOrderInput
): Promise<PriceOrderResult> {
  const context = await loadPricingContext(supabase, input);
  if (!context.ok) return context;

  const { lines, byId, products, discounts, zone, deliveryOption, selectedState, selectedLga, selectedPlace, settings } =
    context;

  const priceLines = (candidates: Discount[]) =>
    priceCartLines({ lines, productsById: byId, candidates });


  // Pass one: what this basket costs with no code. Codes are excluded here by
  // automaticLineDiscounts — leaving them in would apply every influencer code
  // to every shopper, which is the opposite of what a code is for.
  const automatic = automaticLineDiscounts(discounts);
  const withoutCode = priceLines(automatic);

  const resolvedCode = await resolveDiscountCode(supabase, {
    rawCode: input.discountCode,
    activeDiscounts: discounts,
    // The minimum is judged on what the basket costs before the code, which is
    // the figure the customer was shown when they typed it.
    subtotal: sumOf(withoutCode),
    customerEmail: typeof input.customerEmail === 'string' ? input.customerEmail : null,
  });

  const codeDiscount = resolvedCode.discount;
  // A FREE_SHIPPING code never touches a line, so it is not a pricing
  // candidate — it is applied to the delivery fee below.
  const items =
    codeDiscount && codeDiscount.type !== 'FREE_SHIPPING'
      ? priceLines([...automatic, codeDiscount])
      : withoutCode;

  const subtotal = sumOf(items);
  const tax = calculateTax(subtotal, settings.taxRate);

  // Free delivery is applied to the zone's fee rather than replacing it, so an
  // order that qualifies still records which zone it went to and what that
  // zone would have cost — the shop needs both to know what the offer is
  // actually costing it per zone.
  const shippingBeforeOffers = deliveryOption === 'pickup' ? 0 : zone.delivery_fee;
  const afterThreshold = applyFreeShipping(
    shippingBeforeOffers,
    subtotal,
    settings.freeShippingThreshold
  );

  // A standing free-delivery campaign, if one covers this basket. Without
  // this a codeless FREE_SHIPPING discount would be a row nothing ever applied.
  const freeShippingOffer = findFreeShippingDiscount(discounts, subtotal);

  // A FREE_SHIPPING code waives whatever is left. Applied after the standing
  // threshold rather than instead of it, so a customer who already qualified
  // is not told their code saved them something it did not.
  const freeShippingCode = codeDiscount?.type === 'FREE_SHIPPING';
  const shipping = freeShippingCode || freeShippingOffer ? 0 : afterThreshold;

  const appliedCode = codeDiscount
    ? {
        code: resolvedCode.code!,
        discount_id: codeDiscount.id,
        // What the code itself was worth, not what every discount was worth:
        // the difference between the two passes is exactly the code's doing.
        saved_on_items: Math.max(0, sumOf(withoutCode) - subtotal),
        // Zero when a standing campaign had already made delivery free. The
        // code did not save them that, and claiming it did is the sort of
        // double-count that makes a performance report useless.
        saved_on_shipping: freeShippingCode && !freeShippingOffer ? afterThreshold : 0,
      }
    : null;

  return {
    ok: true,
    products,
    priced: {
      items,
      subtotal,
      tax,
      shipping,
      total: subtotal + tax + shipping,
      delivery_option: deliveryOption,
      shipping_zone_id: zone.id,
      selected_state: zone.state,
      selected_lga: selectedLga,
      selected_place: selectedPlace,
      requires_address: deliveryOption === 'delivery' && zone.is_door_delivery,
      applied_code: appliedCode,
      code_error: resolvedCode.error,
    },
  };
}
