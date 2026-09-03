/**
 * COMMERCE layer — product fixtures for the SEO tests.
 *
 * Not a *.test.ts, so vitest's `include` does not collect it as a suite. It
 * exists because product-seo.test.ts and product-jsonld.test.ts describe the
 * same product from two angles — the <head> and the schema.org graph — and had
 * begun to carry byte-identical copies of these builders.
 *
 * Every field is overridable, so a test states only the thing it is about.
 */
import type { Discount } from './discounts';
import type { Product } from '@/types/product';
import type { ProductVariant } from './product-variants';

export const ORIGIN = 'https://shop.example';

export function variant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: 'v1',
    product_id: 'p1',
    size: 'S',
    color: 'red',
    variant_key: 'S|red',
    price: 5000,
    stock: 3,
    image_url: null,
    is_active: true,
    ...overrides,
  };
}

export function product(overrides: Partial<Product> = {}): Product {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Ribbed Bodysuit',
    description: 'A soft ribbed cotton bodysuit.',
    price: 5000,
    category: 'baby-essentials',
    main_image: 'https://cdn.example/main.jpg',
    images: [],
    colors: [],
    sizes: [],
    details: [],
    stock: 3,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

export function sitewide(overrides: Partial<Discount> = {}): Discount {
  return {
    id: 'd1',
    name: 'Sale',
    type: 'PERCENTAGE',
    value: 10,
    scope: 'SITEWIDE',
    target_id: null,
    is_active: true,
    start_date: null,
    end_date: null,
    ...overrides,
  };
}
