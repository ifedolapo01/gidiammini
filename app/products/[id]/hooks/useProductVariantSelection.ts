/** STOREFRONT layer — size/color variant selection state for the product detail page. */
import { useState, useEffect, useMemo } from 'react';
import { Product } from '@/types/product';

export function useProductVariantSelection(product: Product | null) {
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Set default selections once the product loads
  useEffect(() => {
    if (product) {
      if (product.sizes.length > 0) {
        setSelectedSize(product.sizes[0]);
      }
      if (product.colors.length > 0) {
        setSelectedColor(product.colors[0]);
      }
    }
  }, [product]);

  // Derive available colors based on selected size for combination mode
  const availableColors = useMemo(() => {
    if (!product || !product.pricing_config) return product?.colors || [];
    const config = product.pricing_config as any;

    if (config.mode === 'combination' && selectedSize) {
      const combinationPrices = config.combinationPrices || {};
      const colorsForSize = Object.keys(combinationPrices)
        .filter(key => key.startsWith(`${selectedSize}|`))
        .map(key => key.split('|')[1]);
      return colorsForSize.length > 0 ? colorsForSize : (product.colors || []);
    }

    return product.colors || [];
  }, [product, selectedSize]);

  // When selected size changes, ensure selected color is valid for that size
  useEffect(() => {
    if (availableColors.length > 0 && selectedColor && !availableColors.includes(selectedColor)) {
      setSelectedColor(availableColors[0]);
    }
  }, [selectedSize, availableColors, selectedColor]);

  // When selected color changes, swap the main image if a mapped image exists
  useEffect(() => {
    if (product && selectedColor && product.pricing_config) {
      const config = product.pricing_config as any;
      if (config.colorImages && config.colorImages[selectedColor]) {
        const targetUrl = config.colorImages[selectedColor];
        const allImages = [product.main_image, ...(product.images || [])].filter(Boolean);
        const index = allImages.indexOf(targetUrl);
        if (index !== -1) {
          setCurrentImageIndex(index);
        }
      }
    }
  }, [selectedColor, product]);

  return {
    selectedSize,
    setSelectedSize,
    selectedColor,
    setSelectedColor,
    availableColors,
    currentImageIndex,
    setCurrentImageIndex,
  };
}
