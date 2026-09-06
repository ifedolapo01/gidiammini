/**
 * COMMERCE layer (server only) — everything priceOrder needs before it can
 * price anything.
 *
 * Parsing the untrusted request, loading the catalogue, the live discounts,
 * the shipping zones and the store settings, and resolving the address to a
 * zone. All of it can refuse the quote, and each refusal carries the sentence
 * the customer sees.
 *
 * Split out so price-order.ts is only the arithmetic. The two halves change
 * for different reasons — this one when the inputs or the tables change, that
 * one when the money rules do — and reading either was getting harder for the
 * presence of the other.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '@/types/product';
import type { ShippingZone } from '@/types/shipping';
import { ADMIN_VARIANTS_SELECT } from './product-variants';
import { resolveEffectiveZone } from './shipping-match';
import { loadPublicStoreSettings } from './store-settings-server';
import type { Discount } from './discounts';
import type { PublicStoreSettings } from '@/types/settings';
import type { CartLine } from './price-lines';
import type { DeliveryOption } from './cart-input';
import type { PriceOrderInput } from './price-order.types';
import {
  asTrimmedString,
  mergeCartLines,
  parseCartLines,
  parseDeliveryOption,
} from './cart-input';

export interface PricingContext {
  ok: true;
  lines: CartLine[];
  byId: Map<string, Product>;
  products: Product[];
  discounts: Discount[];
  zone: ShippingZone;
  deliveryOption: DeliveryOption;
  selectedState: string;
  selectedLga: string | null;
  selectedPlace: string | null;
  settings: PublicStoreSettings;
}

export type PricingContextResult =
  | PricingContext
  | { ok: false; error: string; status: number };

function fail(error: string, status = 400): { ok: false; error: string; status: number } {
  return { ok: false, error, status };
}

export async function loadPricingContext(
  supabase: SupabaseClient,
  input: PriceOrderInput
): Promise<PricingContextResult> {
  const parsed = parseCartLines(input.items);
  if (typeof parsed === 'string') return fail(parsed);

  const deliveryOption = parseDeliveryOption(input.deliveryOption);
  if (!deliveryOption) return fail('Choose either pickup or delivery.');

  const selectedState = asTrimmedString(input.selectedState);
  if (!selectedState) return fail('Choose the state your order is going to.');

  const selectedLga = asTrimmedString(input.selectedLga);
  const selectedPlace = asTrimmedString(input.selectedPlace);
  const lines = mergeCartLines(parsed);
  const productIds = [...new Set(lines.map((line) => line.product_id))];

  const [productsResult, discountsResult, zonesResult, settings] = await Promise.all([
    // Variants must be embedded: getVariantPrice/getVariantStock read them, and
    // without the embed they would silently fall back to the stale
    // pricing_config maps and price against the wrong numbers.
    supabase.from('products').select(`*, ${ADMIN_VARIANTS_SELECT}`).in('id', productIds).eq('is_active', true),
    supabase.from('discounts').select('*').eq('is_active', true),
    supabase.from('shipping_zones').select('*, shipping_zone_exceptions(*)').eq('is_active', true),
    // The tax rate and the free-delivery threshold. Cached and tag-invalidated
    // (store-settings-server.ts), so this is a read from memory on all but the
    // first request after an owner presses Save — and it falls back to the
    // values that used to be hardcoded rather than failing the quote.
    loadPublicStoreSettings(),
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

  const zone = resolveEffectiveZone(
    zones,
    selectedState,
    selectedLga ?? undefined,
    selectedPlace ?? undefined
  );
  if (!zone) {
    return fail(`We don't deliver to ${selectedState} yet. Please pick another location.`);
  }

  if (deliveryOption === 'pickup' && !zone.pickup_available) {
    return fail(`Pickup isn't available for ${zone.name}. Please choose delivery.`);
  }

  return {
    ok: true,
    lines,
    byId,
    products,
    discounts,
    zone,
    deliveryOption,
    selectedState,
    selectedLga,
    selectedPlace,
    settings,
  };
}
