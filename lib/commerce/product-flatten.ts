/** COMMERCE layer — shared variant flattening logic. Used by Storefront and Admin. */

export interface FlattenedProduct {
  id: string; // A unique composite key (e.g., productId-variantKey)
  productId: string; // The original product ID
  name: string;
  variantKey: string; // 'single' or 'size|color' or 'size' or 'color'
  variantLabel: string; // A human-readable label like "1-2 months / Red"
  category: string;
  sub_category?: string;
  price: number;
  stock: number;
  main_image: string | undefined;
  images: string[] | undefined;
  colorImages?: Record<string, string>;
}

function buildVariantEntry(
  p: any,
  variantKey: string,
  variantLabel: string,
  price: number,
  stock: number
): FlattenedProduct {
  return {
    id: `${p.id}-${variantKey}`,
    productId: p.id,
    name: p.name,
    variantKey,
    variantLabel,
    category: p.category,
    sub_category: p.sub_category,
    price,
    stock,
    main_image: p.main_image || (p.images && p.images[0]),
    images: p.images,
    colorImages: p.pricing_config?.colorImages
  };
}

function buildSingleFallback(p: any): FlattenedProduct {
  const label = [p.pricing_config?.singleSize, p.pricing_config?.singleColor].filter(Boolean).join(' / ') || 'Standard';
  return buildVariantEntry(p, 'single', label, p.price, p.stock);
}

export function flattenProducts(products: any[]): FlattenedProduct[] {
  const flattened: FlattenedProduct[] = [];

  products.forEach(p => {
    const mode = p.pricing_config?.mode;

    if (!p.pricing_config || mode === 'single' || !mode) {
      flattened.push(buildSingleFallback(p));
      return;
    }

    if (mode === 'combination') {
      const prices = p.pricing_config.combinationPrices || {};
      const stocks = p.pricing_config.combinationStock || {};
      const keys = Object.keys(prices);

      if (keys.length === 0) {
        flattened.push(buildSingleFallback(p));
      }

      keys.forEach(key => {
        const [size, color] = key.split('|');
        const label = `${size || ''} / ${color || ''}`.replace(/^\s\/\s|\s\/\s$/g, '');
        flattened.push(buildVariantEntry(p, key, label, prices[key] || 0, stocks[key] || 0));
      });
      return;
    }

    if (mode === 'size') {
      const prices = p.pricing_config.sizePrices || {};
      const stocks = p.pricing_config.sizeStock || {};
      const keys = Object.keys(prices);

      if (keys.length === 0) {
        flattened.push(buildSingleFallback(p));
      }

      keys.forEach(key => {
        flattened.push(buildVariantEntry(p, key, `${key}`, prices[key] || 0, stocks[key] || 0));
      });
      return;
    }

    if (mode === 'color') {
      const prices = p.pricing_config.colorPrices || {};
      const stocks = p.pricing_config.colorStock || {};
      const keys = Object.keys(prices);

      if (keys.length === 0) {
        flattened.push(buildSingleFallback(p));
      }

      keys.forEach(key => {
        flattened.push(buildVariantEntry(p, key, `${key}`, prices[key] || 0, stocks[key] || 0));
      });
    }
  });

  return flattened;
}
