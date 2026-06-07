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

// Order related types
export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  size?: string;
  color?: string;
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id?: string;
  product_name: string;
  price: number;
  quantity: number;
  size: string | null;
  color: string | null;
}

export interface OrderData {
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_amount: number;
  delivery_option: 'pickup' | 'delivery';
  selected_state: string;
  delivery_address?: string;
  city?: string;
  note?: string;
  receipt_url?: string;
  items: OrderItem[];
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  delivery_option: 'pickup' | 'delivery';
  selected_state: string;
  payment_verified: boolean;
  created_at: string;
  updated_at: string;
  receipt_url?: string | null;
  delivery_address?: string | null;
  city?: string | null;
  note?: string | null;
  order_items?: OrderItem[];
}