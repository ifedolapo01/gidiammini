/** COMMERCE layer — shared variant pricing logic. Used by Storefront and Admin. */
import { Product, PricingConfig } from '@/types/product';

export function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

export function formatPriceRange(min: number, max: number): string {
  return min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`;
}

export function getVariantPrice(
  product: Product,
  selectedSize?: string | null,
  selectedColor?: string | null
): number {
  const config = product.pricing_config;
  
  if (!config) {
    return product.price;
  }

  if (config.mode === 'single') {
    return product.price;
  }

  if (config.mode === 'size' && selectedSize) {
    return config.sizePrices?.[selectedSize] ?? product.price;
  }

  if (config.mode === 'color' && selectedColor) {
    return config.colorPrices?.[selectedColor] ?? product.price;
  }

  if (config.mode === 'combination' && selectedSize && selectedColor) {
    const key = `${selectedSize}|${selectedColor}`;
    return config.combinationPrices?.[key] ?? product.price;
  }

  // Fallback if combination is requested but only one variant is selected
  // (e.g. they selected size but color is not selected yet)
  return product.price;
}

export function getVariantStock(
  product: Product,
  selectedSize?: string | null,
  selectedColor?: string | null
): number {
  const config = product.pricing_config;

  if (!config) {
    return product.stock;
  }

  if (config.mode === 'single') {
    const singleStock = (config as any).singleStock;
    return singleStock !== undefined ? singleStock : product.stock;
  }

  if (config.mode === 'size' && selectedSize) {
    return config.sizeStock?.[selectedSize] ?? product.stock;
  }

  if (config.mode === 'color' && selectedColor) {
    return config.colorStock?.[selectedColor] ?? product.stock;
  }

  if (config.mode === 'combination' && selectedSize && selectedColor) {
    const key = `${selectedSize}|${selectedColor}`;
    return config.combinationStock?.[key] ?? product.stock;
  }

  // Fallback if combination is requested but only one variant is selected
  // (e.g. they selected size but color is not selected yet)
  return product.stock;
}

export function getProductPriceRange(product: Product): { min: number; max: number } {
  const config = product.pricing_config;
  
  if (!config || config.mode === 'single') {
    return { min: product.price, max: product.price };
  }

  let prices: number[] = [product.price];

  if (config.mode === 'size' && config.sizePrices) {
    prices = Object.values(config.sizePrices);
  } else if (config.mode === 'color' && config.colorPrices) {
    prices = Object.values(config.colorPrices);
  } else if (config.mode === 'combination' && config.combinationPrices) {
    prices = Object.values(config.combinationPrices);
  }

  // Filter out any invalid numbers
  prices = prices.filter(p => typeof p === 'number' && !isNaN(p));
  
  if (prices.length === 0) {
    return { min: product.price, max: product.price };
  }

  return {
    min: Math.min(...prices),
    max: Math.max(...prices)
  };
}
