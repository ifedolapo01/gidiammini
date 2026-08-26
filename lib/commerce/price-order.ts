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
import type { Product } from '@/types/product';
import type { ShippingZone } from '@/types/shipping';
import { getVariantPrice, getVariantStock } from './pricing';
import { getBestDiscount, calculateDiscountedPrice, type Discount } from './discounts';
import { calculateTax } from './checkout';
import { resolveEffectiveZone } from './shipping-match';
import type { PricedLine, PriceOrderInput, PriceOrderResult } from './price-order.types';
import {
  asTrimmedString,
  mergeCartLines,
  parseCartLines,
  parseDeliveryOption,
} from './cart-input';

export type {
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
      const variant = [line.size, line.color].filter(Boolean).join(' / ');
      const label = variant ? `${line.product_name} (${variant})` : line.product_name;

      return line.available_stock <= 0
        ? `${label} has just sold out.`
        : `Only ${line.available_stock} left of ${label}.`;
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
  const parsed = parseCartLines(input.items);
  if (typeof parsed === 'string') {
    return fail(parsed);
  }

  const deliveryOption = parseDeliveryOption(input.deliveryOption);
  if (!deliveryOption) {
    return fail('Choose either pickup or delivery.');
  }

  const selectedState = asTrimmedString(input.selectedState);
  if (!selectedState) {
    return fail('Choose the state your order is going to.');
  }

  const selectedLga = asTrimmedString(input.selectedLga);
  const selectedPlace = asTrimmedString(input.selectedPlace);
  const lines = mergeCartLines(parsed);
  const productIds = [...new Set(lines.map((line) => line.product_id))];

  const [productsResult, discountsResult, zonesResult] = await Promise.all([
    supabase.from('products').select('*').in('id', productIds).eq('is_active', true),
    supabase.from('discounts').select('*').eq('is_active', true),
    supabase.from('shipping_zones').select('*, shipping_zone_exceptions(*)').eq('is_active', true),
  ]);

  if (productsResult.error) {
    return fail('We could not load the latest prices. Please try again.', 503);
  }

  const products = (productsResult.data || []) as Product[];
  const byId = new Map(products.map((product) => [product.id, product]));

  if (productIds.some((id) => !byId.has(id))) {
    return fail('One or more items in your cart are no longer available. Please review your cart.');
  }

  // A failed discounts read is survivable — nobody gets a markdown. A failed
  // zones read is not, because the delivery fee would be unknowable; that is
  // caught by the no-matching-zone check below.
  const discounts = (discountsResult.data || []) as Discount[];
  const zones = (zonesResult.data || []) as ShippingZone[];

  const zone = resolveEffectiveZone(zones, selectedState, selectedLga ?? undefined, selectedPlace ?? undefined);
  if (!zone) {
    return fail(`We don't deliver to ${selectedState} yet. Please pick another location.`);
  }

  if (deliveryOption === 'pickup' && !zone.pickup_available) {
    return fail(`Pickup isn't available for ${zone.name}. Please choose delivery.`);
  }

  const items: PricedLine[] = lines.map((line) => {
    const product = byId.get(line.product_id)!;
    const basePrice = getVariantPrice(product, line.size, line.color);
    const discount = getBestDiscount(
      product,
      discounts,
      basePrice,
      line.size ?? undefined,
      line.color ?? undefined
    );

    return {
      product_id: product.id,
      product_name: product.name,
      size: line.size,
      color: line.color,
      quantity: line.quantity,
      base_price: basePrice,
      price: calculateDiscountedPrice(basePrice, discount),
      discount_id: discount?.id ?? null,
      available_stock: getVariantStock(product, line.size, line.color),
    };
  });

  const subtotal = items.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const tax = calculateTax(subtotal);
  const shipping = deliveryOption === 'pickup' ? 0 : zone.delivery_fee;

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
    },
  };
}
