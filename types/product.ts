// types/product.ts

import type { ProductVariant } from '@/lib/commerce/product-variants';

export type PricingMode = 'single' | 'size' | 'color' | 'combination';

export interface PricingConfig {
  mode: PricingMode;
  singleStock?: number;
  singleSize?: string;
  singleColor?: string;
  sizePrices?: Record<string, number>;
  sizeStock?: Record<string, number>;
  colorPrices?: Record<string, number>;
  colorStock?: Record<string, number>;
  combinationPrices?: Record<string, number>;
  combinationStock?: Record<string, number>;
  colorImages?: Record<string, string>;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  /** The category slug's child, when the product has one. Nullable in the
   *  database; getBestDiscount matches SUBCATEGORY-scoped discounts on it. */
  sub_category?: string | null;
  main_image: string;
  images: string[];
  colors: string[];
  sizes: string[];
  details: string[];
  stock: number;
  is_active: boolean;
  sizing_type?: 'size' | 'age' | 'maternity' | null;
  /** How this garment runs against its stated size. Drives the line under the
   *  size buttons and the top of the size guide. */
  fit_rating?: 'runs_small' | 'true_to_size' | 'runs_large' | null;
  /** One sentence of specifics under the rating. */
  fit_note?: string | null;
  /**
   * Legacy variant storage. Still written by the admin form and still the
   * source for colorImages, but no longer the source of truth for variant
   * price or stock — see product_variants below.
   */
  pricing_config?: PricingConfig | null;
  /**
   * The sellable combinations, one row each. Present only when the query
   * embedded them; absent is not the same as empty, so read it through
   * lib/commerce/product-variants.ts rather than directly.
   */
  product_variants?: ProductVariant[] | null;
  created_at: string;
  updated_at: string;
}

// More flexible type for ProductCard (with optional fields)
export interface ProductCardProduct extends Pick<Product,
  'id' | 'name' | 'price' | 'category'
> {
  description?: string | null;
  main_image?: string;
  image?: string;
  stock?: number;
  /** Present on rows from list_products(); getBestDiscount needs it to match a
   *  SUBCATEGORY-scoped discount. */
  sub_category?: string | null;
  /**
   * The variant price range, precomputed by list_products().
   *
   * The listing sends these instead of the whole pricing_config JSONB, which
   * the card only ever loaded in order to derive exactly these two numbers.
   * When they are absent the card falls back to getProductPriceRange().
   */
  price_min?: number;
  price_max?: number;
  /**
   * The published-review aggregate, merged in by attachReviewStats() on the
   * server. Absent means the product has no published reviews — the card then
   * draws no star row at all, which is honest, where "0.0 (0)" reads as a bad
   * rating rather than as no rating.
   */
  rating_average?: number;
  review_count?: number;
  is_active?: boolean;
  colors?: string[];
  sizes?: string[];
  images?: string[];
  details?: string[];
  sizing_type?: 'size' | 'age' | 'maternity' | null;
  pricing_config?: PricingConfig | null;
  product_variants?: ProductVariant[] | null;
  created_at?: string;
  updated_at?: string;
}

export interface Subcategory {
  id: string;
  name: string;
  slug: string;
  category_slug: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  /** Free text shown at the top of the size guide for every product in this
   *  category. Edited in the admin; null when nothing has been written. */
  size_guidance?: string | null;
  subcategories: Subcategory[];
}

// Order-related types moved to types/order.ts