/**
 * One product must not be advertised at two prices on two surfaces. This is
 * the shared derivation behind both the full product card and the compact
 * suggestions in the cart drawer, so what it prefers — and when it falls back
 * — is worth pinning down.
 */
import { describe, it, expect } from 'vitest';
import { getCardPricing } from './card-pricing';
import type { ProductCardProduct } from '@/types/product';
import type { Discount } from './discounts';

const card = (overrides: Partial<ProductCardProduct> = {}): ProductCardProduct => ({
  id: 'p1',
  name: 'Ribbed Bodysuit',
  price: 5000,
  category: 'babies',
  ...overrides,
});

const sitewide = (value: number): Discount =>
  ({
    id: 'd1',
    name: 'Launch',
    type: 'PERCENTAGE',
    value,
    scope: 'SITEWIDE',
    target_id: null,
    is_active: true,
    start_date: null,
    end_date: null,
  }) as Discount;

describe('getCardPricing', () => {
  it('prefers the precomputed range from the listing', () => {
    // list_products() derives these in SQL; re-deriving from pricing_config
    // here would be the second implementation the extraction exists to avoid.
    const pricing = getCardPricing(card({ price_min: 4000, price_max: 9000, price: 5000 }));
    expect(pricing).toMatchObject({ min: 4000, max: 9000 });
  });

  it('falls back to the product range when the listing did not send one', () => {
    // The homepage, the wishlist and the recommendation rails pass full rows.
    const pricing = getCardPricing(card({ price: 5000 }));
    expect(pricing).toMatchObject({ min: 5000, max: 5000 });
  });

  it('applies the discount to both ends of the range', () => {
    const pricing = getCardPricing(
      card({ price_min: 4000, price_max: 8000 }),
      [sitewide(25)]
    );
    expect(pricing).toMatchObject({ min: 4000, max: 8000, finalMin: 3000, finalMax: 6000 });
    expect(pricing.discount?.id).toBe('d1');
  });

  it('leaves the range alone and reports no discount when none applies', () => {
    const pricing = getCardPricing(card({ price_min: 4000, price_max: 8000 }), []);
    expect(pricing).toMatchObject({ finalMin: 4000, finalMax: 8000, discount: null });
  });
});
