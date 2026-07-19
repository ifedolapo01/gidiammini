// types/product.ts

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
  main_image: string;
  images: string[];
  colors: string[];
  sizes: string[];
  details: string[];
  stock: number;
  is_active: boolean;
  sizing_type?: 'size' | 'age' | null;
  pricing_config?: PricingConfig | null;
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
  is_active?: boolean;
  colors?: string[];
  sizes?: string[];
  images?: string[];
  details?: string[];
  sizing_type?: 'size' | 'age' | null;
  pricing_config?: PricingConfig | null;
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
  subcategories: Subcategory[];
}

// Order-related types moved to types/order.ts