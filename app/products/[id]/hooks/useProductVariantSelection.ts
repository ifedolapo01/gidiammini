/** STOREFRONT layer — size/color variant selection state for the product detail page. */
import { useState, useEffect, useMemo } from 'react';
import { Product } from '@/types/product';
import { variantsOf } from '@/lib/commerce/product-variants';

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

  // Derive available colors for the selected size from the variant rows.
  const availableColors = useMemo(() => {
    const variants = variantsOf(product);
    if (variants.length === 0 || !selectedSize) return product?.colors || [];

    const colorsForSize = variants
      .filter((v) => v.is_active && v.size === selectedSize && v.color)
      .map((v) => v.color as string);

    return colorsForSize.length > 0 ? colorsForSize : (product?.colors || []);
  }, [product, selectedSize]);

  // When selected size changes, ensure selected color is valid for that size
  useEffect(() => {
    if (availableColors.length > 0 && selectedColor && !availableColors.includes(selectedColor)) {
      setSelectedColor(availableColors[0]);
    }
  }, [selectedSize, availableColors, selectedColor]);

  // When selected color changes, swap the main image if a mapped image exists
  useEffect(() => {
    if (!product || !selectedColor) return;

    const targetUrl = variantsOf(product).find((v) => v.color === selectedColor && v.image_url)?.image_url;
    if (!targetUrl) return;

    const allImages = [product.main_image, ...(product.images || [])].filter(Boolean);
    const index = allImages.indexOf(targetUrl);
    if (index !== -1) {
      setCurrentImageIndex(index);
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
