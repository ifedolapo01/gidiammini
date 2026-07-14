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

export function flattenProducts(products: any[]): FlattenedProduct[] {
  const flattened: FlattenedProduct[] = [];

  products.forEach(p => {
    if (!p.pricing_config || p.pricing_config.mode === 'single' || !p.pricing_config.mode) {
      flattened.push({
        id: `${p.id}-single`,
        productId: p.id,
        name: p.name,
        variantKey: 'single',
        variantLabel: [p.pricing_config?.singleSize, p.pricing_config?.singleColor].filter(Boolean).join(' / ') || 'Standard',
        category: p.category,
        sub_category: p.sub_category,
        price: p.price,
        stock: p.stock,
        main_image: p.main_image || (p.images && p.images[0]),
        images: p.images,
        colorImages: p.pricing_config?.colorImages
      });
    } else if (p.pricing_config.mode === 'combination') {
      const prices = p.pricing_config.combinationPrices || {};
      const stocks = p.pricing_config.combinationStock || {};
      
      const keys = Object.keys(prices);
      if (keys.length === 0) {
        flattened.push({
          id: `${p.id}-single`,
          productId: p.id,
          name: p.name,
          variantKey: 'single',
          variantLabel: [p.pricing_config?.singleSize, p.pricing_config?.singleColor].filter(Boolean).join(' / ') || 'Standard',
          category: p.category,
          sub_category: p.sub_category,
          price: p.price,
          stock: p.stock,
          main_image: p.main_image || (p.images && p.images[0]),
          images: p.images,
          colorImages: p.pricing_config?.colorImages
        });
      }

      keys.forEach(key => {
        const [size, color] = key.split('|');
        flattened.push({
          id: `${p.id}-${key}`,
          productId: p.id,
          name: p.name,
          variantKey: key,
          variantLabel: `${size || ''} / ${color || ''}`.replace(/^\s\/\s|\s\/\s$/g, ''),
          category: p.category,
          sub_category: p.sub_category,
          price: prices[key] || 0,
          stock: stocks[key] || 0,
          main_image: p.main_image || (p.images && p.images[0]),
          images: p.images,
          colorImages: p.pricing_config?.colorImages
        });
      });
    } else if (p.pricing_config.mode === 'size') {
      const prices = p.pricing_config.sizePrices || {};
      const stocks = p.pricing_config.sizeStock || {};
      
      const keys = Object.keys(prices);
      if (keys.length === 0) {
        flattened.push({
          id: `${p.id}-single`,
          productId: p.id,
          name: p.name,
          variantKey: 'single',
          variantLabel: [p.pricing_config?.singleSize, p.pricing_config?.singleColor].filter(Boolean).join(' / ') || 'Standard',
          category: p.category,
          sub_category: p.sub_category,
          price: p.price,
          stock: p.stock,
          main_image: p.main_image || (p.images && p.images[0]),
          images: p.images,
          colorImages: p.pricing_config?.colorImages
        });
      }

      keys.forEach(key => {
        flattened.push({
          id: `${p.id}-${key}`,
          productId: p.id,
          name: p.name,
          variantKey: key,
          variantLabel: `${key}`,
          category: p.category,
          sub_category: p.sub_category,
          price: prices[key] || 0,
          stock: stocks[key] || 0,
          main_image: p.main_image || (p.images && p.images[0]),
          images: p.images,
          colorImages: p.pricing_config?.colorImages
        });
      });
    } else if (p.pricing_config.mode === 'color') {
      const prices = p.pricing_config.colorPrices || {};
      const stocks = p.pricing_config.colorStock || {};
      
      const keys = Object.keys(prices);
      if (keys.length === 0) {
        flattened.push({
          id: `${p.id}-single`,
          productId: p.id,
          name: p.name,
          variantKey: 'single',
          variantLabel: [p.pricing_config?.singleSize, p.pricing_config?.singleColor].filter(Boolean).join(' / ') || 'Standard',
          category: p.category,
          sub_category: p.sub_category,
          price: p.price,
          stock: p.stock,
          main_image: p.main_image || (p.images && p.images[0]),
          images: p.images,
          colorImages: p.pricing_config?.colorImages
        });
      }

      keys.forEach(key => {
        flattened.push({
          id: `${p.id}-${key}`,
          productId: p.id,
          name: p.name,
          variantKey: key,
          variantLabel: `${key}`,
          category: p.category,
          sub_category: p.sub_category,
          price: prices[key] || 0,
          stock: stocks[key] || 0,
          main_image: p.main_image || (p.images && p.images[0]),
          images: p.images,
          colorImages: p.pricing_config?.colorImages
        });
      });
    }
  });

  return flattened;
}
